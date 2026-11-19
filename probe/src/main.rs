use std::cell::RefCell;
use std::ffi::{CString, c_char};

thread_local! {
    static RESULT: RefCell<CString> = RefCell::new(CString::default());
}

/// The result stays valid until the next call. Emscripten copies it into JS.
///
/// # Safety
/// `source` must point to `len` readable bytes for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn check_hack(source: *const u8, len: usize) -> *const c_char {
    let input = if len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(source, len) }
    };
    let result = std::str::from_utf8(input)
        .map_err(|error| error.to_string())
        .and_then(hack_playground::check);
    RESULT.with(|slot| {
        let mut json = slot.borrow_mut();
        *json = CString::new(serde_json::to_vec(&result).unwrap()).unwrap();
        json.as_ptr()
    })
}

fn main() {}
