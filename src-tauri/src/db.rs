use rusqlite::{Connection, Result};
use std::path::PathBuf;

use std::collections::{BTreeMap, HashMap};

pub fn clean_window_title(title: &str) -> String {
    // 去除零宽字符与不可见字符
    let cleaned: String = title
        .chars()
        .filter(|c| !matches!(*c, '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{FEFF}' | '\u{2060}'))
        .collect();
    let mut text = cleaned.trim().replace(" - 个人", "");

    loop {
        let Some(start) = text.find("和另外") else { break };
        let Some(end_rel) = text[start..].find("个页面") else { break };
        let end = start + end_rel + "个页面".len();
        let before = text[..start].trim_end();
        let after = text[end..].trim_start();
        text = if after.starts_with('-') && !before.is_empty() {
            format!("{} {}", before, after)
        } else {
            format!("{}{}", before, after)
        };
    }

    while text.contains("  ") {
        text = text.replace("  ", " ");
    }
    text.trim().to_string()
}

pub fn is_garbage_title(title: &str) -> bool {
    let t = title.trim();
    if t.is_empty() {
        return true;
    }
    // 1) 过长直接跳过(乱码/超长 URL)
    if t.chars().count() > 200 {
        return true;
    }
    // 2) 含长 URL 查询串
    if t.contains("://") {
        return true;
    }
    // 3) 特殊符号过多(URL 编码/查询参数特征)
    let mut sym_count = 0usize;
    for c in t.chars() {
        if matches!(c, '%' | '&' | '?' | '#' | '=') {
            sym_count += 1;
        }
    }
    if sym_count >= 5 {
        return true;
    }
    // 4) 高熵字母数字段: 找一段 >= 28 的字符,只含 [A-Za-z0-9_-+/.] 且字母数字混杂
    let mut run: Vec<char> = Vec::new();
    for c in t.chars() {
        let is_token = c.is_ascii_alphanumeric()
            || matches!(c, '_' | '-' | '+' | '/' | '.' | ':');
        if is_token {
            run.push(c);
            if run.len() >= 28 {
                let s: String = run.iter().collect();
                let has_alpha = s.chars().any(|x| x.is_ascii_alphabetic());
                let has_digit = s.chars().any(|x| x.is_ascii_digit());
                if has_alpha && has_digit {
                    return true;
                }
            }
        } else {
            run.clear();
        }
    }
    false
}
fn matches_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| !n.is_empty() && haystack.contains(n))
}

pub fn app_display_name(process_name: &str, title: &str) -> String {
    let process = process_name.to_lowercase();
    let title_lc = title.to_lowercase();

    // 同时匹配 process 与 title (任一命中即返回)
    let m = |proc_kws: &[&str], title_kws: &[&str]| -> bool {
        matches_any(&process, proc_kws) || matches_any(&title_lc, title_kws)
    };

    // 浏览器 ===========================================================
    if m(&["msedge"], &["microsoft edge", "microsoft\u{200b} edge"]) { return "Microsoft Edge".to_string(); }
    if m(&["chrome"], &["google chrome"]) && !process.contains("chromedriver") { return "Google Chrome".to_string(); }
    if m(&["firefox"], &["firefox"]) { return "Firefox".to_string(); }
    if m(&["brave"], &["brave"]) { return "Brave".to_string(); }
    if m(&["opera"], &["opera"]) { return "Opera".to_string(); }
    if m(&["arc.exe", "arc "], &[]) { return "Arc".to_string(); }
    if m(&["360se", "360chrome"], &["360浏览器", "360安全浏览器"]) { return "360浏览器".to_string(); }
    if m(&["qqbrowser"], &["qq浏览器"]) { return "QQ浏览器".to_string(); }
    if m(&["sogouexplorer"], &["搜狗浏览器", "搜狗高速浏览器"]) { return "搜狗浏览器".to_string(); }
    if m(&["maxthon"], &["maxthon", "傲游"]) { return "傲游浏览器".to_string(); }
    if m(&["vivaldi"], &["vivaldi"]) { return "Vivaldi".to_string(); }
    if m(&["yandex"], &["yandex"]) { return "Yandex".to_string(); }
    if m(&["safari"], &["safari"]) { return "Safari".to_string(); }

    // 开发 / IDE / 编辑器 =================================================
    if m(&["code.exe", "code - ", "code-insiders"], &["visual studio code", "vs code"]) { return "VS Code".to_string(); }
    if m(&["cursor"], &["cursor"]) { return "Cursor".to_string(); }
    if m(&["windsurf"], &["windsurf"]) { return "Windsurf".to_string(); }
    if m(&["zed.exe", "zed-"], &["zed editor"]) { return "Zed".to_string(); }
    if m(&["trae"], &["trae"]) { return "Trae".to_string(); }
    if m(&["idea"], &["intellij idea"]) { return "IntelliJ IDEA".to_string(); }
    if m(&["pycharm"], &["pycharm"]) { return "PyCharm".to_string(); }
    if m(&["webstorm"], &["webstorm"]) { return "WebStorm".to_string(); }
    if m(&["goland"], &["goland"]) { return "GoLand".to_string(); }
    if m(&["rider"], &["jetbrains rider"]) { return "Rider".to_string(); }
    if m(&["clion"], &["clion"]) { return "CLion".to_string(); }
    if m(&["phpstorm"], &["phpstorm"]) { return "PhpStorm".to_string(); }
    if m(&["rubymine"], &["rubymine"]) { return "RubyMine".to_string(); }
    if m(&["datagrip"], &["datagrip"]) { return "DataGrip".to_string(); }
    if m(&["studio64", "studio.exe"], &["android studio"]) { return "Android Studio".to_string(); }
    if m(&["devenv"], &["visual studio "]) { return "Visual Studio".to_string(); }
    if m(&["sublime_text"], &["sublime text"]) { return "Sublime Text".to_string(); }
    if m(&["notepad++"], &["notepad++"]) { return "Notepad++".to_string(); }
    if m(&["notepad.exe"], &["记事本", "- 记事本"]) { return "记事本".to_string(); }
    if m(&["hbuilder"], &["hbuilder"]) { return "HBuilder".to_string(); }
    if m(&["nvim", "vim.exe"], &["neovim", " - vim"]) { return "Vim".to_string(); }
    if m(&["xcode"], &["xcode"]) { return "Xcode".to_string(); }
    if m(&["dbeaver"], &["dbeaver"]) { return "DBeaver".to_string(); }
    if m(&["navicat"], &["navicat"]) { return "Navicat".to_string(); }
    if m(&["postman"], &["postman"]) { return "Postman".to_string(); }
    if m(&["insomnia"], &["insomnia"]) { return "Insomnia".to_string(); }
    if m(&["apifox"], &["apifox"]) { return "Apifox".to_string(); }
    if m(&["fiddler"], &["fiddler"]) { return "Fiddler".to_string(); }
    if m(&["wireshark"], &["wireshark"]) { return "Wireshark".to_string(); }
    if m(&["docker desktop", "dockerdesktop", "docker.exe"], &["docker desktop"]) { return "Docker Desktop".to_string(); }
    if m(&["github desktop", "githubdesktop"], &["github desktop"]) { return "GitHub Desktop".to_string(); }
    if m(&["sourcetree"], &["sourcetree"]) { return "Sourcetree".to_string(); }
    if m(&["fork.exe"], &["fork - "]) { return "Fork".to_string(); }
    if m(&["tortoisegit"], &["tortoisegit"]) { return "TortoiseGit".to_string(); }
    if m(&["unityhub"], &["unity hub"]) { return "Unity Hub".to_string(); }
    if m(&["unity.exe"], &["- unity "]) { return "Unity".to_string(); }
    if m(&["unrealeditor", "ue4editor", "ue5editor"], &["unreal editor"]) { return "Unreal Engine".to_string(); }
    if m(&["godot"], &["godot engine"]) { return "Godot".to_string(); }
    if m(&["blender"], &["blender"]) { return "Blender".to_string(); }
    if m(&["matlab"], &["matlab"]) { return "MATLAB".to_string(); }
    if m(&["rstudio"], &["rstudio"]) { return "RStudio".to_string(); }
    if m(&["jupyter"], &["jupyter"]) { return "Jupyter".to_string(); }
    if m(&["anaconda"], &["anaconda navigator"]) { return "Anaconda".to_string(); }

    // AI 工具 ============================================================
    if m(&["chatgpt"], &["chatgpt"]) { return "ChatGPT".to_string(); }
    if m(&["claude"], &["claude"]) { return "Claude".to_string(); }
    if m(&["copilot"], &["microsoft copilot", "github copilot chat"]) { return "Copilot".to_string(); }
    if m(&["doubao", "豆包"], &["豆包"]) { return "豆包".to_string(); }
    if m(&["kimi"], &["kimi", "月之暗面"]) { return "Kimi".to_string(); }
    if m(&["tongyi"], &["通义", "通义千问"]) { return "通义千问".to_string(); }
    if m(&["wenxin"], &["文心一言", "文心"]) { return "文心一言".to_string(); }
    if m(&["deepseek"], &["deepseek"]) { return "DeepSeek".to_string(); }
    // 沟通 / IM ==========================================================
    if m(&["wechat", "weixin"], &["微信", "wechat"]) { return "微信".to_string(); }
    if m(&["wxwork", "weixinwork", "wxworkapp"], &["企业微信"]) { return "企业微信".to_string(); }
    if m(&["dingtalk"], &["钉钉", "dingtalk"]) { return "钉钉".to_string(); }
    if m(&["feishu", "lark"], &["飞书", "lark"]) { return "飞书".to_string(); }
    if m(&["wemeet"], &["腾讯会议"]) || (process.contains("tencent") && process.contains("meeting")) { return "腾讯会议".to_string(); }
    if m(&["zoom.exe", "zoom "], &["zoom meeting"]) { return "Zoom".to_string(); }
    if m(&["teams"], &["microsoft teams"]) { return "Microsoft Teams".to_string(); }
    if m(&["slack"], &["slack"]) { return "Slack".to_string(); }
    if m(&["discord"], &["discord"]) { return "Discord".to_string(); }
    if m(&["telegram"], &["telegram"]) { return "Telegram".to_string(); }
    if m(&["whatsapp"], &["whatsapp"]) { return "WhatsApp".to_string(); }
    if m(&["line.exe"], &["line"]) && process.contains("line") { return "LINE".to_string(); }
    if m(&["qqnt"], &[]) { return "QQ".to_string(); }
    if (process == "qq.exe" || process == "qq") || (process.contains("qq") && !process.contains("music") && !process.contains("nt") && !process.contains("browser") && !process.contains("player")) { return "QQ".to_string(); }
    if m(&["tim.exe"], &["tim"]) && process.contains("tim") { return "TIM".to_string(); }

    // 邮件 ===============================================================
    if m(&["outlook"], &["outlook"]) { return "Outlook".to_string(); }
    if m(&["thunderbird"], &["thunderbird"]) { return "Thunderbird".to_string(); }
    if m(&["foxmail"], &["foxmail"]) { return "Foxmail".to_string(); }
    if m(&["mailmaster", "网易邮箱"], &["网易邮箱大师"]) { return "网易邮箱大师".to_string(); }
    if m(&["hostmail", "hostmaster"], &["邮件 - "]) { return "邮件".to_string(); }

    // 文档 / 笔记 / 阅读 ================================================
    if m(&["winword"], &["microsoft word", "- word"]) { return "Word".to_string(); }
    if m(&["excel"], &["microsoft excel", "- excel"]) { return "Excel".to_string(); }
    if m(&["powerpnt"], &["powerpoint", "- powerpoint"]) { return "PowerPoint".to_string(); }
    if m(&["onenote"], &["onenote"]) { return "OneNote".to_string(); }
    if m(&["wps", "et.exe", "wpp.exe"], &["wps"]) { return "WPS".to_string(); }
    if m(&["notion"], &["notion"]) { return "Notion".to_string(); }
    if m(&["obsidian"], &["obsidian"]) { return "Obsidian".to_string(); }
    if m(&["typora"], &["typora"]) { return "Typora".to_string(); }
    if m(&["logseq"], &["logseq"]) { return "Logseq".to_string(); }
    if m(&["marktext"], &["mark text"]) { return "Mark Text".to_string(); }
    if m(&["youdaonote"], &["有道云笔记"]) { return "有道云笔记".to_string(); }
    if m(&["yinxiang", "evernote"], &["印象笔记", "evernote"]) { return "印象笔记".to_string(); }
    if m(&["wiznote"], &["为知笔记"]) { return "为知笔记".to_string(); }
    if m(&["flomo"], &["flomo"]) { return "Flomo".to_string(); }
    if m(&["zotero"], &["zotero"]) { return "Zotero".to_string(); }
    if m(&["mendeley"], &["mendeley"]) { return "Mendeley".to_string(); }
    if m(&["acrord32", "acrobat"], &["adobe acrobat"]) { return "Adobe Acrobat".to_string(); }
    if m(&["foxitreader", "foxitpdfreader", "foxitpdfeditor"], &["福昕", "foxit"]) { return "福昕阅读器".to_string(); }
    if m(&["sumatrapdf"], &["sumatrapdf"]) { return "SumatraPDF".to_string(); }
    if m(&["pdfxedit"], &["pdf-xchange"]) { return "PDF-XChange".to_string(); }
    if m(&["calibre"], &["calibre"]) { return "Calibre".to_string(); }
    if m(&["weread"], &["微信读书"]) { return "微信读书".to_string(); }
    if m(&["kindle"], &["kindle"]) { return "Kindle".to_string(); }

    // 设计 / 创作 ========================================================
    if m(&["figma"], &["figma"]) { return "Figma".to_string(); }
    if m(&["photoshop"], &["photoshop"]) { return "Photoshop".to_string(); }
    if m(&["illustrator"], &["illustrator"]) { return "Illustrator".to_string(); }
    if m(&["indesign"], &["indesign"]) { return "InDesign".to_string(); }
    if m(&["lightroom"], &["lightroom"]) { return "Lightroom".to_string(); }
    if m(&["premiere"], &["premiere pro"]) { return "Premiere Pro".to_string(); }
    if m(&["afterfx", "aftereffects"], &["after effects"]) { return "After Effects".to_string(); }
    if m(&["audition"], &["adobe audition"]) { return "Audition".to_string(); }
    if m(&["mediaencoder"], &["adobe media encoder"]) { return "Media Encoder".to_string(); }
    if m(&["jianyingpro"], &["剪映"]) { return "剪映".to_string(); }
    if m(&["capcut"], &["capcut"]) { return "CapCut".to_string(); }
    if m(&["davinci", "resolve"], &["davinci resolve", "达芬奇"]) { return "DaVinci Resolve".to_string(); }
    if m(&["obs64", "obs.exe", "obs-studio"], &["obs studio"]) { return "OBS Studio".to_string(); }
    if m(&["sketch"], &["sketch"]) { return "Sketch".to_string(); }
    if m(&["xd.exe", "adobe xd"], &["adobe xd"]) { return "Adobe XD".to_string(); }
    if m(&["affinity"], &["affinity"]) { return "Affinity".to_string(); }
    if m(&["clipstudio", "clipstudiopaint"], &["clip studio"]) { return "Clip Studio Paint".to_string(); }
    if m(&["procreate"], &["procreate"]) { return "Procreate".to_string(); }
    if m(&["krita"], &["krita"]) { return "Krita".to_string(); }
    if m(&["gimp"], &["gimp"]) { return "GIMP".to_string(); }
    if m(&["inkscape"], &["inkscape"]) { return "Inkscape".to_string(); }
    if m(&["mihoyo", "miyoushe"], &["米游社"]) { return "米游社".to_string(); }
    // 终端 / 命令行 =======================================================
    if m(&["windowsterminal"], &["windows terminal"]) { return "Windows Terminal".to_string(); }
    if m(&["wezterm"], &["wezterm"]) { return "WezTerm".to_string(); }
    if m(&["alacritty"], &["alacritty"]) { return "Alacritty".to_string(); }
    if m(&["powershell", "pwsh"], &["powershell"]) { return "PowerShell".to_string(); }
    if process == "cmd.exe" || process == "cmd" { return "命令提示符".to_string(); }
    if m(&["xshell"], &["xshell"]) { return "Xshell".to_string(); }
    if m(&["mobaxterm"], &["mobaxterm"]) { return "MobaXterm".to_string(); }
    if m(&["putty"], &["putty"]) { return "PuTTY".to_string(); }
    if m(&["finalshell"], &["finalshell"]) { return "FinalShell".to_string(); }
    if m(&["tabby"], &["tabby"]) { return "Tabby".to_string(); }

    // 音乐 ==============================================================
    if m(&["cloudmusic"], &["网易云音乐"]) { return "网易云音乐".to_string(); }
    if m(&["qqmusic"], &["qq音乐"]) { return "QQ音乐".to_string(); }
    if m(&["spotify"], &["spotify"]) { return "Spotify".to_string(); }
    if m(&["applemusic"], &["apple music"]) { return "Apple Music".to_string(); }
    if m(&["kugou"], &["酷狗音乐"]) { return "酷狗音乐".to_string(); }
    if m(&["kuwo"], &["酷我音乐"]) { return "酷我音乐".to_string(); }
    if m(&["youtubemusic"], &["youtube music"]) { return "YouTube Music".to_string(); }
    if m(&["foobar2000"], &["foobar2000"]) { return "foobar2000".to_string(); }

    // 视频 ==============================================================
    if m(&["bilibili"], &["哔哩哔哩", "bilibili"]) { return "哔哩哔哩".to_string(); }
    if m(&["iqiyi"], &["爱奇艺"]) { return "爱奇艺".to_string(); }
    if m(&["qqlive"], &["腾讯视频"]) { return "腾讯视频".to_string(); }
    if m(&["youku"], &["优酷"]) { return "优酷".to_string(); }
    if m(&["mgtv"], &["芒果tv"]) { return "芒果TV".to_string(); }
    if m(&["potplayer"], &["potplayer"]) { return "PotPlayer".to_string(); }
    if m(&["vlc"], &["vlc media player"]) { return "VLC".to_string(); }
    if m(&["mpv.exe"], &["mpv"]) { return "mpv".to_string(); }
    if m(&["kmplayer"], &["kmplayer"]) { return "KMPlayer".to_string(); }
    if m(&["netflix"], &["netflix"]) { return "Netflix".to_string(); }

    // 短视频/社交 =======================================================
    if m(&["douyin"], &["抖音"]) { return "抖音".to_string(); }
    if m(&["kwai", "kuaishou"], &["快手"]) { return "快手".to_string(); }
    if m(&["xiaohongshu", "redbook"], &["小红书"]) { return "小红书".to_string(); }
    if m(&["weibo"], &["微博"]) { return "微博".to_string(); }
    if m(&["zhihu"], &["知乎"]) { return "知乎".to_string(); }

    // 游戏平台 ==========================================================
    if m(&["steamwebhelper", "steam.exe"], &["steam"]) && !title_lc.contains("powered by steam") { return "Steam".to_string(); }
    if m(&["epicgameslauncher", "epicwebhelper"], &["epic games"]) { return "Epic Games".to_string(); }
    if m(&["battle.net", "battlenet"], &["battle.net"]) { return "Battle.net".to_string(); }
    if m(&["uplay", "upc.exe", "ubisoftconnect"], &["ubisoft connect"]) { return "Ubisoft Connect".to_string(); }
    if m(&["origin.exe", "eadesktop"], &["ea app", "origin"]) { return "EA App".to_string(); }
    if m(&["riotclient", "riotgames"], &["riot client"]) { return "Riot Client".to_string(); }
    if m(&["wegame"], &["wegame"]) { return "WeGame".to_string(); }

    // 具体游戏 ==========================================================
    if m(&["genshinimpact", "yuanshen"], &["原神", "genshin impact"]) { return "原神".to_string(); }
    if m(&["starrail"], &["崩坏:星穹铁道", "honkai: star rail"]) { return "崩坏:星穹铁道".to_string(); }
    if m(&["honkaiimpact", "bh3"], &["崩坏3"]) { return "崩坏3".to_string(); }
    if m(&["zenlesszonezero", "zzz"], &["绝区零", "zenless zone zero"]) { return "绝区零".to_string(); }
    if m(&["leagueclient", "league of legends"], &["英雄联盟", "league of legends"]) { return "英雄联盟".to_string(); }
    if m(&["valorant"], &["valorant", "无畏契约"]) { return "无畏契约".to_string(); }
    if m(&["dota2"], &["dota 2"]) { return "Dota 2".to_string(); }
    if m(&["csgo", "cs2"], &["counter-strike", "csgo", "cs2"]) { return "Counter-Strike".to_string(); }
    if m(&["pubg", "tslgame"], &["pubg", "battlegrounds", "绝地求生"]) { return "PUBG".to_string(); }
    if m(&["apex"], &["apex legends", "apex 英雄"]) { return "Apex Legends".to_string(); }
    if m(&["overwatch"], &["overwatch", "守望先锋"]) { return "守望先锋".to_string(); }
    if m(&["fortnite"], &["fortnite", "堡垒之夜"]) { return "堡垒之夜".to_string(); }
    if m(&["minecraft", "javaw"], &["minecraft"]) && (process.contains("minecraft") || title_lc.contains("minecraft")) { return "Minecraft".to_string(); }
    if m(&["delta_force", "deltaforce", "三角洲"], &["三角洲行动", "delta force"]) { return "三角洲行动".to_string(); }
    if m(&["naraka"], &["naraka", "永劫无间"]) { return "永劫无间".to_string(); }
    if m(&["forzahorizon", "forza"], &["forza horizon", "极限竞速"]) { return "极限竞速:地平线".to_string(); }
    if m(&["wuthering", "wutheringwaves"], &["鸣潮", "wuthering waves"]) { return "鸣潮".to_string(); }
    if m(&["worldofwarcraft"], &["世界of warcraft", "魔兽世界"]) { return "魔兽世界".to_string(); }
    if m(&["hearthstone"], &["炉石传说", "hearthstone"]) { return "炉石传说".to_string(); }
    if m(&["lostark"], &["lost ark"]) { return "Lost Ark".to_string(); }
    if m(&["eldenring"], &["elden ring", "艾尔登法环"]) { return "艾尔登法环".to_string(); }
    if m(&["cyberpunk"], &["cyberpunk 2077", "赛博朋克"]) { return "赛博朋克 2077".to_string(); }
    if m(&["gtav", "gta5"], &["grand theft auto", "侠盗猎车手"]) { return "GTA".to_string(); }
    // 系统 / 工具 =======================================================
    if process == "explorer.exe" || process == "explorer" { return "文件资源管理器".to_string(); }
    if m(&["systemsettings"], &[]) { return "Windows 设置".to_string(); }
    if process == "taskmgr.exe" || process == "taskmgr" { return "任务管理器".to_string(); }
    if m(&["snippingtool", "screenclippinghost"], &["截图工具"]) { return "截图工具".to_string(); }
    if process == "calc.exe" || process == "calc" { return "计算器".to_string(); }
    if m(&["mspaint"], &["画图"]) { return "画图".to_string(); }
    if m(&["sticky"], &["便笺"]) { return "便笺".to_string(); }
    if m(&["snipaste"], &["snipaste"]) { return "Snipaste".to_string(); }
    if m(&["sharex"], &["sharex"]) { return "ShareX".to_string(); }
    if m(&["everything.exe"], &["everything"]) { return "Everything".to_string(); }
    if m(&["utools"], &["utools"]) { return "uTools".to_string(); }
    if m(&["powertoys"], &["powertoys"]) { return "PowerToys".to_string(); }

    // 网盘 / 同步 =======================================================
    if m(&["onedrive"], &["onedrive"]) { return "OneDrive".to_string(); }
    if m(&["baidunetdisk"], &["百度网盘"]) { return "百度网盘".to_string(); }
    if m(&["aliyunpan"], &["阿里云盘"]) { return "阿里云盘".to_string(); }
    if m(&["123pan"], &["123云盘", "123pan"]) { return "123云盘".to_string(); }
    if m(&["dropbox"], &["dropbox"]) { return "Dropbox".to_string(); }

    // 下载 ==============================================================
    if m(&["thunder", "迅雷"], &["迅雷"]) { return "迅雷".to_string(); }
    if m(&["idman"], &["internet download manager"]) { return "IDM".to_string(); }
    if m(&["motrix"], &["motrix"]) { return "Motrix".to_string(); }
    if m(&["qbittorrent"], &["qbittorrent"]) { return "qBittorrent".to_string(); }

    // 兜底 ===============================================================
    let process_clean = process_name.trim_end_matches(".exe").trim();
    if !process_clean.is_empty() && process_clean != "unknown" {
        return process_clean.to_string();
    }
    let cleaned = clean_window_title(title);
    if cleaned.is_empty() { "未知应用".to_string() } else { cleaned }
}

pub fn is_browser_process(process_name: &str, _title: &str) -> bool {
    let p = process_name.to_lowercase();
    p.contains("msedge")
        || (p.contains("chrome") && !p.contains("chromedriver"))
        || p.contains("firefox")
        || p.contains("opera")
        || p.contains("brave")
        || p.contains("arc.exe")
        || p.contains("vivaldi")
        || p.contains("360se")
        || p.contains("qqbrowser")
        || p.contains("sogouexplorer")
        || p.contains("maxthon")
}

pub fn app_category(app_name: &str) -> &'static str {
    match app_name {
        // 开发
        "VS Code" | "Cursor" | "Windsurf" | "Zed" | "Trae" | "Visual Studio"
        | "IntelliJ IDEA" | "PyCharm" | "WebStorm" | "GoLand" | "Rider" | "CLion"
        | "PhpStorm" | "RubyMine" | "DataGrip" | "Android Studio"
        | "Sublime Text" | "Notepad++" | "记事本" | "HBuilder" | "Vim" | "Xcode"
        | "DBeaver" | "Navicat" | "Postman" | "Insomnia" | "Apifox"
        | "Fiddler" | "Wireshark" | "Docker Desktop"
        | "GitHub Desktop" | "Sourcetree" | "Fork" | "TortoiseGit"
        | "Unity" | "Unity Hub" | "Unreal Engine" | "Godot" | "Blender"
        | "MATLAB" | "RStudio" | "Jupyter" | "Anaconda" => "开发",

        // 浏览
        "Microsoft Edge" | "Google Chrome" | "Firefox" | "Brave" | "Opera" | "Arc"
        | "Vivaldi" | "Yandex" | "Safari"
        | "360浏览器" | "QQ浏览器" | "搜狗浏览器" | "傲游浏览器" => "浏览",

        // 沟通
        "微信" | "企业微信" | "QQ" | "TIM" | "钉钉" | "飞书" | "腾讯会议"
        | "Zoom" | "Microsoft Teams" | "Slack" | "Discord" | "Telegram" | "WhatsApp"
        | "LINE" => "沟通",

        // 邮件
        "Outlook" | "Thunderbird" | "Foxmail" | "网易邮箱大师" | "邮件" => "邮件",

        // 文档
        "Word" | "Excel" | "PowerPoint" | "OneNote" | "WPS"
        | "Notion" | "Obsidian" | "Typora" | "Logseq" | "Mark Text"
        | "有道云笔记" | "印象笔记" | "为知笔记" | "Flomo"
        | "Zotero" | "Mendeley"
        | "Adobe Acrobat" | "福昕阅读器" | "SumatraPDF" | "PDF-XChange" | "Calibre"
        | "微信读书" | "Kindle" => "文档",

        // 设计
        "Figma" | "Photoshop" | "Illustrator" | "InDesign" | "Lightroom"
        | "Premiere Pro" | "After Effects" | "Audition" | "Media Encoder"
        | "剪映" | "CapCut" | "DaVinci Resolve" | "OBS Studio"
        | "Sketch" | "Adobe XD" | "Affinity"
        | "Clip Studio Paint" | "Procreate" | "Krita" | "GIMP" | "Inkscape" => "设计",

        // 命令行
        "Windows Terminal" | "WezTerm" | "Alacritty" | "PowerShell" | "命令提示符"
        | "Xshell" | "MobaXterm" | "PuTTY" | "FinalShell" | "Tabby" => "命令行",

        // AI
        "ChatGPT" | "Claude" | "Copilot" | "豆包" | "Kimi" | "通义千问" | "文心一言"
        | "DeepSeek" => "AI",

        // 娱乐 - 音乐与视频
        "网易云音乐" | "QQ音乐" | "Spotify" | "Apple Music" | "酷狗音乐" | "酷我音乐"
        | "YouTube Music" | "foobar2000"
        | "哔哩哔哩" | "爱奇艺" | "腾讯视频" | "优酷" | "芒果TV"
        | "PotPlayer" | "VLC" | "mpv" | "KMPlayer" | "Netflix"
        | "抖音" | "快手" | "小红书" | "微博" | "知乎" => "娱乐",

        // 游戏
        "Steam" | "Epic Games" | "Battle.net" | "Ubisoft Connect" | "EA App"
        | "Riot Client" | "WeGame" | "米游社"
        | "原神" | "崩坏:星穹铁道" | "崩坏3" | "绝区零" | "鸣潮"
        | "英雄联盟" | "无畏契约" | "Dota 2" | "Counter-Strike"
        | "PUBG" | "Apex Legends" | "守望先锋" | "堡垒之夜" | "Minecraft"
        | "三角洲行动" | "永劫无间" | "极限竞速:地平线"
        | "魔兽世界" | "炉石传说" | "Lost Ark"
        | "艾尔登法环" | "赛博朋克 2077" | "GTA" => "游戏",

        // 系统
        "文件资源管理器" | "Windows 设置" | "任务管理器" | "截图工具" | "计算器"
        | "画图" | "便笺" | "Snipaste" | "ShareX"
        | "Everything" | "uTools" | "PowerToys" => "系统",

        // 网盘
        "OneDrive" | "百度网盘" | "阿里云盘" | "123云盘" | "Dropbox" => "网盘",

        // 下载
        "迅雷" | "IDM" | "Motrix" | "qBittorrent" => "下载",

        _ => "其他",
    }
}

pub fn category_emoji(category: &str) -> &'static str {
    match category {
        "开发" => "🛠️",
        "浏览" => "🌐",
        "沟通" => "💬",
        "邮件" => "📧",
        "文档" => "📄",
        "设计" => "🎨",
        "命令行" => "💻",
        "AI" => "🤖",
        "娱乐" => "🎵",
        "游戏" => "🎮",
        "系统" => "🗂️",
        "网盘" => "☁️",
        "下载" => "⬇️",
        _ => "📂",
    }
}
pub fn display_title(process_name: &str, raw_title: &str) -> String {
    let cleaned = clean_window_title(raw_title);
    let app_name = app_display_name(process_name, &cleaned);
    let process = process_name.to_lowercase();
    let is_browser = matches!(app_name.as_str(), "Microsoft Edge" | "Google Chrome" | "Firefox");
    if is_browser {
        if cleaned.is_empty() { app_name } else { cleaned }
    } else if process.contains("explorer") {
        "文件资源管理器".to_string()
    } else {
        app_name
    }
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path();
        let conn = Connection::open(&db_path)?;
        Self::init_tables(&conn)?;
        Ok(Self { conn })
    }

    fn get_db_path() -> PathBuf {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("daynote");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir.join("daynote.db")
    }

    fn init_tables(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS activity_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                window_title TEXT NOT NULL,
                process_name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                date TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_date ON activity_records(date);
            CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                kind TEXT NOT NULL,
                status TEXT NOT NULL,
                label TEXT,
                date TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_pomo_date ON pomodoro_sessions(date);",
        )?;
        Ok(())
    }

    pub fn insert_record(
        &self,
        window_title: &str,
        process_name: &str,
        start_time: &str,
        end_time: &str,
        duration_secs: i64,
        date: &str,
    ) -> Result<i64> {
        if is_garbage_title(window_title) {
            return Ok(0);
        }
        let window_title = clean_window_title(window_title);
        self.conn.execute(
            "INSERT INTO activity_records (window_title, process_name, start_time, end_time, duration_secs, date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![window_title, process_name, start_time, end_time, duration_secs, date],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_records_by_date(&self, date: &str) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, window_title, process_name, start_time, end_time, duration_secs, date
             FROM activity_records WHERE date = ?1 AND length(window_title) <= 200 AND window_title NOT LIKE '%://%' ORDER BY start_time",
        )?;
        let rows = stmt.query_map(rusqlite::params![date], |row| {
            let raw_title: String = row.get::<_, String>(1)?;
            let window_title = clean_window_title(&raw_title);
            Ok((raw_title, serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "window_title": window_title,
                "process_name": row.get::<_, String>(2)?,
                "start_time": row.get::<_, String>(3)?,
                "end_time": row.get::<_, String>(4)?,
                "duration_secs": row.get::<_, i64>(5)?,
                "date": row.get::<_, String>(6)?,
            })))
        })?;
        let records: Vec<serde_json::Value> = rows
            .filter_map(|r| r.ok())
            .filter(|(raw, _)| !is_garbage_title(raw))
            .map(|(_, v)| v)
            .collect();
        Ok(records)
    }

    pub fn get_summary_by_date(&self, date: &str) -> Result<serde_json::Value> {
        let total: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM activity_records WHERE date = ?1 AND length(window_title) <= 200 AND window_title NOT LIKE '%://%'",
            rusqlite::params![date],
            |row| row.get(0),
        )?;

        let mut stmt = self.conn.prepare(
            "SELECT process_name, SUM(duration_secs) as total
             FROM activity_records WHERE date = ?1 AND length(window_title) <= 200 AND window_title NOT LIKE '%://%' GROUP BY process_name ORDER BY total DESC",
        )?;
        let windows: Vec<serde_json::Value> = stmt
            .query_map(rusqlite::params![date], |row| {
                Ok(serde_json::json!({
                    "process_name": row.get::<_, String>(0)?,
                    "duration_secs": row.get::<_, i64>(1)?,
                }))
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(serde_json::json!({
            "total_focus_secs": total,
            "window_stats": windows,
        }))
    }

    pub fn delete_record(&self, id: i64) -> Result<bool> {
        let affected = self.conn.execute(
            "DELETE FROM activity_records WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(affected > 0)
    }

    pub fn get_recent_days(&self, days: i64) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT date, COALESCE(SUM(duration_secs), 0) as total
             FROM activity_records
             WHERE date >= date('now', ?1) AND length(window_title) <= 200 AND window_title NOT LIKE '%://%'
             GROUP BY date
             ORDER BY date",
        )?;
        let date_param = format!("-{} days", days);
        let rows = stmt.query_map(rusqlite::params![date_param], |row| {
            Ok(serde_json::json!({
                "date": row.get::<_, String>(0)?,
                "total_secs": row.get::<_, i64>(1)?,
            }))
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_weekly_app_usage(&self, start_date: &str) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT date, window_title, process_name, duration_secs
             FROM activity_records
             WHERE date >= ?1 AND date <= date(?1, '+6 days') AND length(window_title) <= 200 AND window_title NOT LIKE '%://%'
             ORDER BY date, start_time",
        )?;

        let rows = stmt.query_map(rusqlite::params![start_date], |row| {
            let date: String = row.get(0)?;
            let title: String = row.get(1)?;
            let process: String = row.get(2)?;
            let duration: i64 = row.get(3)?;
            Ok((date, app_display_name(&process, &title), duration))
        })?;

        let mut by_day: BTreeMap<String, HashMap<String, i64>> = BTreeMap::new();
        for row in rows.filter_map(|r| r.ok()) {
            let (date, app_name, duration) = row;
            *by_day.entry(date).or_default().entry(app_name).or_default() += duration;
        }

        let mut days = Vec::new();
        for (date, apps_map) in by_day {
            let mut apps: Vec<_> = apps_map.into_iter().collect();
            apps.sort_by(|a, b| b.1.cmp(&a.1));
            let total_secs: i64 = apps.iter().map(|(_, secs)| *secs).sum();
            let app_values: Vec<serde_json::Value> = apps
                .into_iter()
                .map(|(app_name, duration_secs)| serde_json::json!({
                    "app_name": app_name,
                    "duration_secs": duration_secs,
                }))
                .collect();

            days.push(serde_json::json!({
                "date": date,
                "total_secs": total_secs,
                "apps": app_values,
            }));
        }

        Ok(days)
    }
}

impl Database {
    pub fn record_exists(&self, start_time: &str, process_name: &str, window_title: &str) -> Result<bool> {
        let cleaned = clean_window_title(window_title);
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(1) FROM activity_records WHERE start_time = ?1 AND process_name = ?2 AND window_title = ?3",
            rusqlite::params![start_time, process_name, cleaned],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_all_records(&self) -> Result<Vec<serde_json::Value>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, window_title, process_name, start_time, end_time, duration_secs, date
             FROM activity_records WHERE length(window_title) <= 200 AND window_title NOT LIKE '%://%' ORDER BY date, start_time",
        )?;
        let rows = stmt.query_map([], |row| {
            let window_title = clean_window_title(&row.get::<_, String>(1)?);
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "window_title": window_title,
                "process_name": row.get::<_, String>(2)?,
                "start_time": row.get::<_, String>(3)?,
                "end_time": row.get::<_, String>(4)?,
                "duration_secs": row.get::<_, i64>(5)?,
                "date": row.get::<_, String>(6)?,
            }))
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn delete_garbage(&self) -> Result<usize> {
        let n = self.conn.execute(
            "DELETE FROM activity_records WHERE length(window_title) > 200 OR window_title LIKE '%://%'",
            [],
        )?;
        Ok(n)
    }

    pub fn pomodoro_save(&self, start_time: &str, end_time: &str, duration_secs: i64, kind: &str, status: &str, label: Option<&str>, date: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO pomodoro_sessions (start_time, end_time, duration_secs, kind, status, label, date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![start_time, end_time, duration_secs, kind, status, label, date],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn pomodoro_today(&self, date: &str) -> Result<serde_json::Value> {
        let mut stmt = self.conn.prepare(
            "SELECT id, start_time, end_time, duration_secs, kind, status, label FROM pomodoro_sessions WHERE date = ?1 ORDER BY start_time"
        )?;
        let rows = stmt.query_map(rusqlite::params![date], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "start_time": row.get::<_, String>(1)?,
                "end_time": row.get::<_, String>(2)?,
                "duration_secs": row.get::<_, i64>(3)?,
                "kind": row.get::<_, String>(4)?,
                "status": row.get::<_, String>(5)?,
                "label": row.get::<_, Option<String>>(6)?,
            }))
        })?;
        let sessions: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        let focus_completed = sessions.iter().filter(|s| s["kind"] == "focus" && s["status"] == "completed").count();
        let total_focus_secs: i64 = sessions.iter()
            .filter(|s| s["kind"] == "focus" && s["status"] == "completed")
            .filter_map(|s| s["duration_secs"].as_i64())
            .sum();
        Ok(serde_json::json!({
            "sessions": sessions,
            "focus_completed": focus_completed,
            "total_focus_secs": total_focus_secs,
        }))
    }

    pub fn delete_older_than(&self, retention_days: i64) -> Result<usize> {
        let cutoff = format!("-{} days", retention_days);
        let affected = self.conn.execute(
            "DELETE FROM activity_records WHERE date < date('now', ?1)",
            rusqlite::params![cutoff],
        )?;
        Ok(affected)
    }

    pub fn get_month_app_usage(&self, year: i32, month: u32) -> Result<Vec<serde_json::Value>> {
        let start_date = format!("{:04}-{:02}-01", year, month);
        let mut stmt = self.conn.prepare(
            "SELECT date, window_title, process_name, duration_secs
             FROM activity_records
             WHERE date >= ?1 AND date < date(?1, '+1 month') AND length(window_title) <= 200 AND window_title NOT LIKE '%://%'
             ORDER BY date, start_time",
        )?;

        let rows = stmt.query_map(rusqlite::params![start_date], |row| {
            let date: String = row.get(0)?;
            let title: String = row.get(1)?;
            let process: String = row.get(2)?;
            let duration: i64 = row.get(3)?;
            Ok((date, app_display_name(&process, &title), duration))
        })?;

        let mut by_day: BTreeMap<String, HashMap<String, i64>> = BTreeMap::new();
        for row in rows.filter_map(|r| r.ok()) {
            let (date, app_name, duration) = row;
            *by_day.entry(date).or_default().entry(app_name).or_default() += duration;
        }

        let mut days = Vec::new();
        for (date, apps_map) in by_day {
            let mut apps: Vec<_> = apps_map.into_iter().collect();
            apps.sort_by(|a, b| b.1.cmp(&a.1));
            let total_secs: i64 = apps.iter().map(|(_, secs)| *secs).sum();
            let app_values: Vec<serde_json::Value> = apps
                .into_iter()
                .map(|(app_name, duration_secs)| serde_json::json!({
                    "app_name": app_name,
                    "duration_secs": duration_secs,
                }))
                .collect();

            days.push(serde_json::json!({
                "date": date,
                "total_secs": total_secs,
                "apps": app_values,
            }));
        }

        Ok(days)
    }
}
