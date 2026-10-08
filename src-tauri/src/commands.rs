use std::fs;
use std::path::{Path, PathBuf};

const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "tga", "dds", "bmp", "gif", "webp", "tif", "tiff",
];
const SKIP_DIRS: &[&str] = &["node_modules", ".git", ".svn", "Library", "Temp", "obj", "bin"];
const MAX_FILES: usize = 5000;

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if out.len() >= MAX_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= MAX_FILES {
            return;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else { continue };
        if file_type.is_dir() {
            let name = entry.file_name();
            let skip = SKIP_DIRS.iter().any(|s| name.to_string_lossy() == *s);
            if depth > 0 && !skip {
                walk(&path, depth - 1, out);
            }
        } else if is_image(&path) {
            out.push(path);
        }
    }
}

/// Lists image files that a model may reference: everything under the model's folder
/// (3 levels deep) plus the parent folder and its direct sub-folders (e.g. `../Textures`).
/// The frontend matches texture references against this list, so FBX files that carry
/// absolute paths from another machine still find their textures.
#[tauri::command]
pub async fn scan_textures(model_path: String) -> Result<Vec<String>, String> {
    let model = PathBuf::from(&model_path);
    let dir = model
        .parent()
        .ok_or_else(|| format!("Invalid model path: {model_path}"))?;

    let mut found = Vec::new();
    walk(dir, 3, &mut found);
    if let Some(parent) = dir.parent() {
        let mut siblings = Vec::new();
        walk(parent, 1, &mut siblings);
        found.extend(siblings.into_iter().filter(|p| !p.starts_with(dir)));
    }

    Ok(found
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect())
}

/// Copies an original texture file to the export location, keeping its exact format.
#[tauri::command]
pub async fn copy_file(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&from, &to).map(|_| ()).map_err(|e| e.to_string())
}
