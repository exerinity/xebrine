use std::fs;
use std::path::Path;

use ab_glyph::FontRef;
use image::Rgba;
use image::RgbaImage;

use crate::core::{find_font_for_glyph, GLYPH};
use crate::render::{composite_centered, gradient_canvas, render_glyph, resize_to_fit};

const SIZES: [u32; 2] = [192, 512];

#[derive(Clone, Copy)]
enum Background {
    Gradient,
    Transparent,
    Black,
    White,
}

impl Background {
    fn suffix(self) -> &'static str {
        match self {
            Self::Gradient => "",
            Self::Transparent => "-transparent",
            Self::Black => "-black",
            Self::White => "-white",
        }
    }

    fn glyph_color(self) -> Rgba<u8> {
        match self {
            Self::White => Rgba([0, 0, 0, 255]),
            Self::Gradient | Self::Transparent | Self::Black => Rgba([255, 255, 255, 255]),
        }
    }
}

fn write_icon(dir: &Path, size: u32, background: Background, font: &FontRef) {
    let glyph_box = (size as f32 * 0.64).round() as u32;
    let glyph = render_glyph(font, glyph_box * 2, background.glyph_color());
    let glyph = resize_to_fit(&glyph, glyph_box);

    let mut canvas = match background {
        Background::Gradient => {
            gradient_canvas(size, Rgba([0x2e, 0x16, 0x83, 255]), Rgba([0x4a, 0x29, 0xc2, 255]))
        }
        Background::Transparent => RgbaImage::new(size, size),
        Background::Black => RgbaImage::from_pixel(size, size, Rgba([0, 0, 0, 255])),
        Background::White => RgbaImage::from_pixel(size, size, Rgba([255, 255, 255, 255])),
    };
    composite_centered(&mut canvas, &glyph);

    let out_path = dir.join(format!("icon-{size}{}.png", background.suffix()));
    canvas
        .save(&out_path)
        .unwrap_or_else(|e| panic!("failed to write {}: {e}", out_path.display()));
    println!("wrote public/app/media/{}", out_path.file_name().unwrap().to_string_lossy());
}

pub fn run() {
    let transparent = std::env::args().any(|a| a == "--transparent");
    let blank_background = std::env::args().any(|a| a == "--blank-background");
    let white_background = std::env::args().any(|a| a == "--white-background");
    assert!(
        [transparent, blank_background, white_background]
            .into_iter()
            .filter(|enabled| *enabled)
            .count()
            <= 1,
        "only one background option can be used at a time"
    );
    let background = if white_background {
        Background::White
    } else if blank_background {
        Background::Black
    } else if transparent {
        Background::Transparent
    } else {
        Background::Gradient
    };

    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("tools/icon-gen should live two levels under the project root")
        .to_path_buf();
    let out_dir = root.join("public").join("app").join("media");
    fs::create_dir_all(&out_dir).expect("failed to create output directory");

    let matched = find_font_for_glyph(GLYPH as u32);
    println!("rendering {GLYPH} with {}", matched.path.display());

    let font_data = fs::read(&matched.path)
        .unwrap_or_else(|e| panic!("failed to read font {}: {e}", matched.path.display()));
    let font = FontRef::try_from_slice_and_index(&font_data, matched.index.max(0) as u32)
        .unwrap_or_else(|_| panic!("failed to parse font {}", matched.path.display()));

    for size in SIZES {
        write_icon(&out_dir, size, background, &font);
    }
}
