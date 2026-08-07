use std::ffi::CStr;
use std::os::raw::c_char;
use std::path::PathBuf;
use std::ptr;

use fontconfig_sys::constants::{FC_CHARSET, FC_FILE, FC_INDEX};
use fontconfig_sys::{
    FcChar32, FcCharSetAddChar, FcCharSetCreate, FcCharSetDestroy, FcConfigSubstitute,
    FcDefaultSubstitute, FcFontMatch, FcInit, FcMatchPattern, FcPattern, FcPatternAddCharSet,
    FcPatternCreate, FcPatternDestroy, FcPatternGetInteger, FcPatternGetString, FcResultMatch,
    FcResultNoMatch,
};

pub const GLYPH: char = '\u{1D1DB}';

pub struct MatchedFont {
    pub path: PathBuf,
    pub index: i32,
}

pub fn find_font_for_glyph(codepoint: u32) -> MatchedFont {
    unsafe {
        assert_eq!(FcInit(), 1, "FcInit failed");

        let charset = FcCharSetCreate();
        assert!(!charset.is_null());
        assert_eq!(
            FcCharSetAddChar(charset, codepoint as FcChar32),
            1,
            "failed to add codepoint to charset"
        );

        let pattern = FcPatternCreate();
        assert!(!pattern.is_null());
        assert_eq!(
            FcPatternAddCharSet(pattern, FC_CHARSET.as_ptr(), charset),
            1,
            "failed to attach charset to pattern"
        );

        FcDefaultSubstitute(pattern);
        FcConfigSubstitute(ptr::null_mut(), pattern, FcMatchPattern);

        let mut result = FcResultNoMatch;
        let matched = FcFontMatch(ptr::null_mut(), pattern, &mut result);
        assert!(
            !matched.is_null() && result == FcResultMatch,
            "no installed font covers U+{codepoint:X}"
        );

        let path = get_string(matched, FC_FILE.as_ptr())
            .unwrap_or_else(|| panic!("matched font has no file path"));
        let index = get_int(matched, FC_INDEX.as_ptr()).unwrap_or(0);

        FcPatternDestroy(matched);
        FcPatternDestroy(pattern);
        FcCharSetDestroy(charset);

        MatchedFont { path: PathBuf::from(path), index }
    }
}

unsafe fn get_string(pattern: *mut FcPattern, object: *const c_char) -> Option<String> {
    let mut out = ptr::null_mut();
    if FcPatternGetString(pattern, object, 0, &mut out) == FcResultMatch {
        Some(CStr::from_ptr(out as *const c_char).to_string_lossy().into_owned())
    } else {
        None
    }
}

unsafe fn get_int(pattern: *mut FcPattern, object: *const c_char) -> Option<i32> {
    let mut out: i32 = 0;
    if FcPatternGetInteger(pattern, object, 0, &mut out) == FcResultMatch {
        Some(out)
    } else {
        None
    }
}
