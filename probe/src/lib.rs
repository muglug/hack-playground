use std::path::Path;
use std::sync::Arc;

use hh::{ctx::Ctx, diagnostics, hh_single_type_check, typing_check_service};
use pos::{Prefix, RelativePath};
use serde_json::{Value, json};

pub fn check(source: &str) -> Result<Vec<Value>, String> {
    let root = Path::new("/");
    hh_single_type_check::set_path_prefixes(root);
    let mut ctx = Ctx::new(root, Default::default()).map_err(|error| error.to_string())?;
    ctx.add_magic_builtins();
    let path = RelativePath::new(Prefix::Dummy, Path::new("main.hack"));
    ctx.files.set(path, source);

    // The native driver declares files in parallel. Both the editor buffer
    // and the built-in declarations already live in the context's overlay.
    for file in ctx.hhi_paths.iter().copied().chain([path]) {
        let decls = ctx
            .decl_parser
            .parse(file)
            .map_err(|error| error.to_string())?;
        ctx.declare_file(file, decls);
    }
    let ctx = Arc::new(ctx);
    hh_single_type_check::install(&ctx);

    let errors = typing_check_service::process_file(&ctx, &path.into(), false);
    Ok(diagnostics::get_sorted_diagnostic_list(None, errors)
        .into_iter()
        .map(|diagnostic| {
            let pos = diagnostic.claim.0;
            let message = diagnostic.claim.1;
            let (line, column, _) = pos.info_pos();
            json!({
                "file": pos.filename().path().display().to_string(),
                "line": line,
                "column": column,
                "code": diagnostic.code,
                "message": message.to_string(),
            })
        })
        .collect())
}
