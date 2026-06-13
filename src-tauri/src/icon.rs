pub fn load_tray_icon() -> Option<tauri::image::Image<'static>> {
    let bytes = include_bytes!("../icons/32x32.png");
    match image::load_from_memory(bytes) {
        Ok(img) => {
            let rgba = img.into_rgba8();
            let (w, h) = rgba.dimensions();
            let data: &'static mut [u8] = rgba.into_raw().leak();
            Some(tauri::image::Image::new(&*data, w, h))
        }
        Err(e) => {
            log::error!("加载托盘图标失败: {}", e);
            None
        }
    }
}