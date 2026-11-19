use std::cell::OnceCell;
use std::path::Path;
use std::sync::Arc;

use hh::{
    ctx::Ctx, diagnostics, hh_single_type_check, provider_context, provider_utils,
    typing_check_service,
};
use pos::{Prefix, RelativePath};
use serde_json::{Value, json};

thread_local! {
    static BUILTINS: OnceCell<Result<Arc<Ctx>, String>> = const { OnceCell::new() };
}

fn load_builtins() -> Result<Arc<Ctx>, String> {
    let root = Path::new("/");
    hh_single_type_check::set_path_prefixes(root);
    let mut ctx = Ctx::new(root, Default::default()).map_err(|error| error.to_string())?;
    ctx.add_magic_builtins();
    for &file in &ctx.hhi_paths {
        let decls = ctx
            .decl_parser
            .parse(file)
            .map_err(|error| error.to_string())?;
        ctx.declare_file(file, decls);
    }
    let ctx = Arc::new(ctx);
    hh_single_type_check::install(&ctx);
    Ok(ctx)
}

fn message(pos: &hh::pos::Pos, text: &impl ToString) -> Value {
    let (line, column, _) = pos.info_pos();
    let (start, end) = pos.info_raw();
    json!({
        "file": pos.filename().path().display().to_string(),
        "line": line,
        "column": column,
        "start": start,
        "end": end,
        "message": text.to_string(),
    })
}

pub fn check(source: &str) -> Result<Vec<Value>, String> {
    let base = BUILTINS.with(|cell| cell.get_or_init(load_builtins).clone())?;
    let path = RelativePath::new(Prefix::Dummy, Path::new("main.hack")).into();
    let (ctx, entry) =
        provider_context::add_or_overwrite_entry_contents(&base, path, source.into());
    let errors = provider_utils::respect_but_quarantine_unsaved_changes(&ctx, || {
        typing_check_service::process_file(&ctx, &entry.path, false)
    });
    Ok(diagnostics::get_sorted_diagnostic_list(None, errors)
        .into_iter()
        .map(|diagnostic| {
            let mut claim = message(&diagnostic.claim.0, &diagnostic.claim.1);
            claim["phase"] = json!(hh::diagnostics_helpers::phase_of_code(diagnostic.code));
            claim["custom_messages"] = json!(diagnostic.custom_msgs);
            claim["code"] = json!(diagnostic.code);
            claim["reasons"] = diagnostic
                .reasons
                .iter()
                .map(|reason| message(&reason.0, &reason.1))
                .collect();
            claim
        })
        .collect())
}
