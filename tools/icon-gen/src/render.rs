use ab_glyph::{Font, FontRef, GlyphId, OutlinedGlyph, Point};
use image::{Rgba, RgbaImage};

use crate::core::GLYPH;

fn outlined_glyph(font: &FontRef, size_px: f32) -> OutlinedGlyph {
    let glyph_id: GlyphId = font.glyph_id(GLYPH);
    let glyph = glyph_id.with_scale_and_position(size_px, Point { x: 0.0, y: 0.0 });
    font.outline_glyph(glyph).expect("font has no outline for glyph")
}

pub fn render_glyph(font: &FontRef, target_box: u32, color: Rgba<u8>) -> RgbaImage {
    let probe = outlined_glyph(font, 1000.0);
    let bounds = probe.px_bounds();
    let scale = target_box as f32 / bounds.width().max(bounds.height());
    let glyph = outlined_glyph(font, 1000.0 * scale);
    let bounds = glyph.px_bounds();

    let w = bounds.width().ceil().max(1.0) as u32;
    let h = bounds.height().ceil().max(1.0) as u32;
    let mut img = RgbaImage::new(w, h);
    glyph.draw(|x, y, coverage| {
        let alpha = (coverage * color[3] as f32).round().clamp(0.0, 255.0) as u8;
        img.put_pixel(x, y, Rgba([color[0], color[1], color[2], alpha]));
    });
    img
}

pub fn resize_to_fit(img: &RgbaImage, max_side: u32) -> RgbaImage {
    let (w, h) = img.dimensions();
    if w.max(h) == max_side {
        return img.clone();
    }
    let scale = max_side as f32 / w.max(h) as f32;
    let new_w = ((w as f32 * scale).round() as u32).max(1);
    let new_h = ((h as f32 * scale).round() as u32).max(1);
    image::imageops::resize(img, new_w, new_h, image::imageops::FilterType::Lanczos3)
}

pub fn composite_centered(canvas: &mut RgbaImage, glyph: &RgbaImage) {
    let (cw, ch) = canvas.dimensions();
    let (gw, gh) = glyph.dimensions();
    let ox = (cw as i64 - gw as i64) / 2;
    let oy = (ch as i64 - gh as i64) / 2;
    image::imageops::overlay(canvas, glyph, ox, oy);
}

fn lerp(a: u8, b: u8, t: f32) -> u8 {
    (a as f32 + (b as f32 - a as f32) * t).round() as u8
}

pub fn gradient_canvas(size: u32, from: Rgba<u8>, to: Rgba<u8>) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    for y in 0..size {
        let t = y as f32 / (size - 1).max(1) as f32;
        let pixel = Rgba([
            lerp(from[0], to[0], t),
            lerp(from[1], to[1], t),
            lerp(from[2], to[2], t),
            255,
        ]);
        for x in 0..size {
            img.put_pixel(x, y, pixel);
        }
    }
    img
}
