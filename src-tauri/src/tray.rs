use crate::types::{FavoriteTask, RunningProcess};
use log::info;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

// Tray state manager for dynamic menu updates
pub struct TrayState {
    running_processes: Arc<StdMutex<Vec<RunningProcess>>>,
    favorite_tasks: Arc<StdMutex<Vec<FavoriteTask>>>,
}

impl TrayState {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(StdMutex::new(Vec::new())),
            favorite_tasks: Arc::new(StdMutex::new(Vec::new())),
        }
    }
    
    pub fn set_running_processes(&self, processes: Vec<RunningProcess>) {
        if let Ok(mut guard) = self.running_processes.lock() {
            *guard = processes;
        }
    }
    
    pub fn get_running_processes(&self) -> Vec<RunningProcess> {
        self.running_processes.lock().map(|g| g.clone()).unwrap_or_default()
    }
    
    pub fn set_favorite_tasks(&self, tasks: Vec<FavoriteTask>) {
        if let Ok(mut guard) = self.favorite_tasks.lock() {
            *guard = tasks;
        }
    }
    
    pub fn get_favorite_tasks(&self) -> Vec<FavoriteTask> {
        self.favorite_tasks.lock().map(|g| g.clone()).unwrap_or_default()
    }
}

/// Update tray menu with running processes
#[tauri::command]
pub fn update_tray_running_processes(
    processes: Vec<RunningProcess>,
    tray_state: tauri::State<'_, TrayState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    info!("[TRAY] Updating running processes: {:?}", processes.len());
    tray_state.set_running_processes(processes);
    rebuild_tray_menu(&app_handle, &tray_state)?;
    Ok(())
}

/// Update tray menu with favorite tasks
#[tauri::command]
pub fn update_tray_favorites(
    favorites: Vec<FavoriteTask>,
    tray_state: tauri::State<'_, TrayState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    info!("[TRAY] Updating favorite tasks: {:?}", favorites.len());
    tray_state.set_favorite_tasks(favorites);
    rebuild_tray_menu(&app_handle, &tray_state)?;
    Ok(())
}

/// Rebuild the tray menu with current state
pub fn rebuild_tray_menu(app: &tauri::AppHandle, tray_state: &TrayState) -> Result<(), String> {
    let tray = app.tray_by_id("rust-tray")
        .ok_or("Tray not found")?;
    
    let running = tray_state.get_running_processes();
    let favorites = tray_state.get_favorite_tasks();
    
    // Create new menu
    let menu = Menu::new(app)
        .map_err(|e| e.to_string())?;
    
    // Show main window item
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&show_item).map_err(|e| e.to_string())?;
    
    // Separator
    let sep1 = PredefinedMenuItem::separator(app)
        .map_err(|e| e.to_string())?;
    menu.append(&sep1).map_err(|e| e.to_string())?;
    
    // Running processes section
    if !running.is_empty() {
        let running_label = MenuItem::with_id(app, "running_label", "▶ 运行中的进程", false, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&running_label).map_err(|e| e.to_string())?;
        
        for process in &running {
            // Create submenu for each running process with restart/stop options
            let restart_item = MenuItem::with_id(
                app, 
                &format!("restart:{}", process.id), 
                "⟳ 重启", 
                true, 
                None::<&str>
            ).map_err(|e| e.to_string())?;
            
            let stop_item = MenuItem::with_id(
                app, 
                &format!("stop:{}", process.id), 
                "■ 停止", 
                true, 
                None::<&str>
            ).map_err(|e| e.to_string())?;
            
            let process_submenu = Submenu::with_items(
                app,
                &process.name,
                true,
                &[&restart_item, &stop_item]
            ).map_err(|e| e.to_string())?;
            
            menu.append(&process_submenu).map_err(|e| e.to_string())?;
        }
        
        // Separator after running processes
        let sep2 = PredefinedMenuItem::separator(app)
            .map_err(|e| e.to_string())?;
        menu.append(&sep2).map_err(|e| e.to_string())?;
    }
    
    // Favorites section
    if !favorites.is_empty() {
        let favorites_label = MenuItem::with_id(app, "favorites_label", "★ 收藏夹", false, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&favorites_label).map_err(|e| e.to_string())?;
        
        for task in &favorites {
            let task_item = MenuItem::with_id(
                app, 
                &format!("run_favorite:{}", task.id), 
                &task.name, 
                true, 
                None::<&str>
            ).map_err(|e| e.to_string())?;
            menu.append(&task_item).map_err(|e| e.to_string())?;
        }
        
        // Separator after favorites
        let sep3 = PredefinedMenuItem::separator(app)
            .map_err(|e| e.to_string())?;
        menu.append(&sep3).map_err(|e| e.to_string())?;
    }
    
    // Quit item
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    menu.append(&quit_item).map_err(|e| e.to_string())?;
    
    tray.set_menu(Some(menu))
        .map_err(|e| e.to_string())?;
    
    info!("[TRAY] Menu rebuilt successfully");
    Ok(())
}
