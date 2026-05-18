//! # sabflow-node-derive
//!
//! Attribute macro `#[node(...)]` that generates the boilerplate
//! `impl sabflow_nodes::Node for ...` block from a single `async fn execute`.
//!
//! Goal: bring a typical node file from ~80 lines down to ~15 by hiding the
//! descriptor-builder, the `#[async_trait]` impl scaffold, and the import
//! ceremony. Authors keep full control of `execute` and may optionally provide
//! `fn properties()` and `fn credentials()` helpers inside the same `impl`.
//!
//! ## Example
//!
//! ```ignore
//! use sabflow_nodes::{
//!     ExecutionContext, NodeInput, NodeOutput, NodeResult, NodeProperty,
//!     NodePropertyType, descriptor::NodeCategory,
//! };
//! use sabflow_node_derive::node;
//! use serde_json::Value;
//!
//! /// Sleep for `ms` milliseconds.
//! pub struct WaitNode;
//!
//! #[node(
//!     name = "wait",
//!     display = "Wait",
//!     description = "Pause execution for a fixed duration",
//!     category = "logic",
//!     icon = "clock",
//!     color = "#a3a3a3"
//! )]
//! impl WaitNode {
//!     fn properties() -> Vec<NodeProperty> {
//!         vec![NodeProperty::new("ms", "Milliseconds", NodePropertyType::Number)]
//!     }
//!
//!     async fn execute(
//!         &self,
//!         _ctx: &mut ExecutionContext,
//!         input: NodeInput,
//!         _params: &Value,
//!     ) -> NodeResult<NodeOutput> {
//!         Ok(NodeOutput::single(input.items))
//!     }
//! }
//! ```
//!
//! ## Supported attribute keys
//!
//! | key            | required | type           | maps to `NodeDescriptor` field      |
//! |----------------|----------|----------------|--------------------------------------|
//! | `name`         | yes      | string         | `name` (stable identifier)           |
//! | `display`      | yes      | string         | `display_name`                       |
//! | `description`  | yes      | string         | `description`                        |
//! | `category`     | yes      | ident / string | `category` (NodeCategory variant)    |
//! | `icon`         | no       | string         | `icon`                               |
//! | `color`        | no       | string         | `color`                              |
//! | `version`      | no       | integer        | `version` (defaults to 1)            |
//! | `is_trigger`   | no       | bool           | sets `is_trigger = true`, `inputs=0` |
//! | `outputs`      | no       | integer        | `outputs`                            |
//! | `stub`         | no       | bool           | marks descriptor as a stub           |
//!
//! Category values accept either an ident (`category = Logic`) or a string
//! (`category = "logic"`). Strings are normalised case-insensitively against
//! the [`NodeCategory`] enum variants.

extern crate proc_macro;

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use syn::{
    parse::{Parse, ParseStream},
    parse_macro_input,
    punctuated::Punctuated,
    spanned::Spanned,
    Expr, ExprLit, ImplItem, ItemImpl, Lit, LitBool, LitInt, LitStr, MetaNameValue, Token, Type,
};

// ---------------------------------------------------------------------------
// Attribute parsing
// ---------------------------------------------------------------------------

#[derive(Default)]
struct NodeAttrs {
    name: Option<LitStr>,
    display: Option<LitStr>,
    description: Option<LitStr>,
    category: Option<TokenStream2>,
    icon: Option<LitStr>,
    color: Option<LitStr>,
    version: Option<LitInt>,
    is_trigger: bool,
    outputs: Option<LitInt>,
    stub: bool,
}

impl Parse for NodeAttrs {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let nv: Punctuated<MetaNameValue, Token![,]> =
            Punctuated::parse_terminated(input)?;
        let mut out = NodeAttrs::default();

        for entry in nv {
            let key = entry
                .path
                .get_ident()
                .map(|i| i.to_string())
                .ok_or_else(|| {
                    syn::Error::new(entry.path.span(), "expected `key = value` attribute")
                })?;

            match key.as_str() {
                "name" => out.name = Some(expr_to_lit_str(&entry.value)?),
                "display" | "display_name" => {
                    out.display = Some(expr_to_lit_str(&entry.value)?)
                }
                "description" => out.description = Some(expr_to_lit_str(&entry.value)?),
                "category" => out.category = Some(parse_category(&entry.value)?),
                "icon" => out.icon = Some(expr_to_lit_str(&entry.value)?),
                "color" => out.color = Some(expr_to_lit_str(&entry.value)?),
                "version" => out.version = Some(expr_to_lit_int(&entry.value)?),
                "is_trigger" => out.is_trigger = expr_to_lit_bool(&entry.value)?.value,
                "outputs" => out.outputs = Some(expr_to_lit_int(&entry.value)?),
                "stub" => out.stub = expr_to_lit_bool(&entry.value)?.value,
                other => {
                    return Err(syn::Error::new(
                        entry.path.span(),
                        format!("unknown #[node(...)] key: `{other}`"),
                    ));
                }
            }
        }

        Ok(out)
    }
}

fn expr_to_lit_str(expr: &Expr) -> syn::Result<LitStr> {
    if let Expr::Lit(ExprLit { lit: Lit::Str(s), .. }) = expr {
        Ok(s.clone())
    } else {
        Err(syn::Error::new(expr.span(), "expected string literal"))
    }
}

fn expr_to_lit_int(expr: &Expr) -> syn::Result<LitInt> {
    if let Expr::Lit(ExprLit { lit: Lit::Int(i), .. }) = expr {
        Ok(i.clone())
    } else {
        Err(syn::Error::new(expr.span(), "expected integer literal"))
    }
}

fn expr_to_lit_bool(expr: &Expr) -> syn::Result<LitBool> {
    if let Expr::Lit(ExprLit { lit: Lit::Bool(b), .. }) = expr {
        Ok(b.clone())
    } else {
        Err(syn::Error::new(expr.span(), "expected bool literal"))
    }
}

/// Accept either `category = Logic` (an ident) or `category = "logic"` (a string).
/// Output is a token stream that resolves to a `NodeCategory` variant path.
fn parse_category(expr: &Expr) -> syn::Result<TokenStream2> {
    match expr {
        Expr::Path(p) => {
            // Allow `Logic` (relative) or `NodeCategory::Logic` (already qualified).
            let path = &p.path;
            if path.segments.len() == 1 {
                let ident = &path.segments[0].ident;
                Ok(quote! { ::sabflow_nodes::descriptor::NodeCategory::#ident })
            } else {
                Ok(quote! { #path })
            }
        }
        Expr::Lit(ExprLit { lit: Lit::Str(s), .. }) => {
            let variant = normalise_category(&s.value()).ok_or_else(|| {
                syn::Error::new(
                    s.span(),
                    format!(
                        "unknown NodeCategory: `{}` (expected one of: trigger, action, logic, transform, ai, communication, productivity, crm, marketing, developer, database, storage, analytics, files, sales, finance, hr, misc)",
                        s.value()
                    ),
                )
            })?;
            let ident = format_ident!("{}", variant);
            Ok(quote! { ::sabflow_nodes::descriptor::NodeCategory::#ident })
        }
        _ => Err(syn::Error::new(
            expr.span(),
            "expected an ident (e.g. `Logic`) or string (e.g. `\"logic\"`)",
        )),
    }
}

/// Map a free-form category string to a `NodeCategory` variant. Returns the
/// PascalCase variant ident or `None` if unknown.
fn normalise_category(raw: &str) -> Option<&'static str> {
    let normalised = raw.to_lowercase().replace(['-', '_', ' '], "");
    Some(match normalised.as_str() {
        "trigger" => "Trigger",
        "action" => "Action",
        "logic" => "Logic",
        "transform" => "Transform",
        "ai" => "Ai",
        "communication" => "Communication",
        "productivity" => "Productivity",
        "crm" => "Crm",
        "marketing" => "Marketing",
        "developer" => "Developer",
        "database" => "Database",
        "storage" => "Storage",
        "analytics" => "Analytics",
        "files" => "Files",
        "sales" => "Sales",
        "finance" => "Finance",
        "hr" => "Hr",
        "misc" => "Misc",
        _ => return None,
    })
}

// ---------------------------------------------------------------------------
// `#[node(...)] impl FooNode { ... }`
// ---------------------------------------------------------------------------

/// Attribute macro applied to a regular `impl Block { ... }` to generate the
/// matching `impl sabflow_nodes::Node` implementation.
///
/// The user impl block may contain any combination of:
///   - `async fn execute(&self, ctx, input, params) -> NodeResult<NodeOutput>` — **required**.
///   - `fn properties() -> Vec<NodeProperty>` — optional; folded into the descriptor.
///   - `fn credentials() -> Vec<CredentialBinding>` — optional; folded into the descriptor.
///   - any other items (helper fns, consts) are passed through untouched.
///
/// See crate-level docs for the full attribute key reference.
#[proc_macro_attribute]
pub fn node(args: TokenStream, item: TokenStream) -> TokenStream {
    let attrs = parse_macro_input!(args as NodeAttrs);
    let user_impl = parse_macro_input!(item as ItemImpl);

    match expand(attrs, user_impl) {
        Ok(ts) => ts.into(),
        Err(e) => e.into_compile_error().into(),
    }
}

fn expand(attrs: NodeAttrs, user_impl: ItemImpl) -> syn::Result<TokenStream2> {
    // Validate required attributes.
    let name = attrs
        .name
        .as_ref()
        .ok_or_else(|| syn::Error::new(proc_macro2::Span::call_site(), "missing `name = \"...\"`"))?;
    let display = attrs
        .display
        .as_ref()
        .ok_or_else(|| syn::Error::new(proc_macro2::Span::call_site(), "missing `display = \"...\"`"))?;
    let description = attrs
        .description
        .as_ref()
        .ok_or_else(|| {
            syn::Error::new(proc_macro2::Span::call_site(), "missing `description = \"...\"`")
        })?;
    let category = attrs
        .category
        .clone()
        .ok_or_else(|| syn::Error::new(proc_macro2::Span::call_site(), "missing `category = ...`"))?;

    // Unwrap the implementing type.
    if user_impl.trait_.is_some() {
        return Err(syn::Error::new(
            user_impl.span(),
            "#[node] must be applied to an inherent `impl FooNode { ... }`, not a trait impl",
        ));
    }
    let self_ty: &Type = &user_impl.self_ty;

    // Pull out execute / properties / credentials by name, keep everything else
    // as inherent items on the type.
    let mut execute_fn: Option<TokenStream2> = None;
    let mut properties_fn: Option<TokenStream2> = None;
    let mut credentials_fn: Option<TokenStream2> = None;
    let mut other_items: Vec<ImplItem> = Vec::new();

    for it in user_impl.items {
        if let ImplItem::Fn(f) = &it {
            let ident = f.sig.ident.to_string();
            match ident.as_str() {
                "execute" => {
                    if f.sig.asyncness.is_none() {
                        return Err(syn::Error::new(
                            f.sig.span(),
                            "`execute` must be `async fn`",
                        ));
                    }
                    let block = &f.block;
                    let sig = &f.sig;
                    execute_fn = Some(quote! { #sig #block });
                    continue;
                }
                "properties" => {
                    let block = &f.block;
                    properties_fn = Some(quote! { #block });
                    continue;
                }
                "credentials" => {
                    let block = &f.block;
                    credentials_fn = Some(quote! { #block });
                    continue;
                }
                _ => {}
            }
        }
        other_items.push(it);
    }

    let execute_fn = execute_fn.ok_or_else(|| {
        syn::Error::new(
            user_impl.self_ty.span(),
            "`#[node]` impl block must contain `async fn execute(&self, ctx, input, params) -> NodeResult<NodeOutput>`",
        )
    })?;

    // ── Descriptor builder ─────────────────────────────────────────────────
    // The chain uses only methods already exposed by `NodeDescriptor` so the
    // macro stays decoupled from descriptor-builder additions.
    let mut chain = TokenStream2::new();
    if let Some(icon) = &attrs.icon {
        chain.extend(quote! { .icon(#icon) });
    }
    if let Some(color) = &attrs.color {
        chain.extend(quote! { .color(#color) });
    }
    if attrs.is_trigger {
        chain.extend(quote! { .trigger() });
    }
    if let Some(out) = &attrs.outputs {
        chain.extend(quote! { .outputs(#out) });
    }
    if attrs.stub {
        chain.extend(quote! { .stub() });
    }

    let props_call = if let Some(body) = properties_fn {
        // `body` is already a brace-delimited block; use it directly as the arg.
        quote! { .properties(#body) }
    } else {
        quote! {}
    };
    let creds_call = if let Some(body) = credentials_fn {
        quote! { .credentials(#body) }
    } else {
        quote! {}
    };

    // `version` isn't on the builder; mutate the field directly when set.
    let version_override = if let Some(v) = &attrs.version {
        quote! { _d.version = #v; }
    } else {
        quote! {}
    };

    let descriptor_fn = quote! {
        fn descriptor(&self) -> ::sabflow_nodes::descriptor::NodeDescriptor {
            let mut _d = ::sabflow_nodes::descriptor::NodeDescriptor::new(
                #name,
                #display,
                #description,
                #category,
            )
            #chain
            #props_call
            #creds_call;
            #version_override
            _d
        }
    };

    // Re-emit any remaining inherent items so authors can keep helper fns.
    let inherent_extras = if other_items.is_empty() {
        quote! {}
    } else {
        quote! {
            impl #self_ty {
                #(#other_items)*
            }
        }
    };

    Ok(quote! {
        #inherent_extras

        #[::async_trait::async_trait]
        impl ::sabflow_nodes::node::Node for #self_ty {
            #descriptor_fn

            #execute_fn
        }
    })
}

