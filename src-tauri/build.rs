fn main() {
    println!("cargo:rerun-if-changed=.pake/pake.json");
    println!("cargo:rerun-if-changed=.pake/tauri.conf.json");
    println!("cargo:rerun-if-changed=src/inject/auth.js");
    println!("cargo:rerun-if-changed=src/inject/custom.js");
    println!("cargo:rerun-if-changed=src/inject/event.js");
    println!("cargo:rerun-if-changed=src/inject/find.js");
    println!("cargo:rerun-if-changed=src/inject/fullscreen.js");
    println!("cargo:rerun-if-changed=src/inject/style.js");
    println!("cargo:rerun-if-changed=src/inject/theme_refresh.js");
    println!("cargo:rerun-if-changed=src/inject/toast.js");
    tauri_build::build()
}
