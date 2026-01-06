use crate::types::{FavoriteTask, RecentTask, RunningProcess};
use log::info;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

// Tray state manager for dynamic menu updates
pub struct TrayState {
    running_processes: Arc<StdMutex<Vec<RunningProcess>>>,
    favorite_tasks: Arc<StdMutex<Vec<FavoriteTask>>>,
    recent_tasks: Arc<StdMutex<Vec<RecentTask>>>,
}

impl TrayState {
    pub fn new() -> Self {
        Self {
            running_processes: Arc::new(StdMutex::new(Vec::new())),
            favorite_tasks: Arc::new(StdMutex::new(Vec::new())),
            recent_tasks: Arc::new(StdMutex::new(Vec::new())),
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
    
    pub fn set_recent_tasks(&self, tasks: Vec<RecentTask>) {
        if let Ok(mut guard) = self.recent_tasks.lock() {
            *guard = tasks;
        }
    }
    
    pub fn get_recent_tasks(&self) -> Vec<RecentTask> {
        self.recent_tasks.lock().map(|g| g.clone()).unwrap_or_default()
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

/// Update tray menu with recent tasks
#[tauri::command]
pub fn update_tray_recent_tasks(
    recent: Vec<RecentTask>,
    tray_state: tauri::State<'_, TrayState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    info!("[TRAY] Updating recent tasks: {:?}", recent.len());
    tray_state.set_recent_tasks(recent);
    rebuild_tray_menu(&app_handle, &tray_state)?;
    Ok(())
}

/// Check if a task is currently running by its task_id
fn is_task_running<'a>(task_id: &str, running: &'a [RunningProcess]) -> Option<&'a RunningProcess> {
    running.iter().find(|p| p.task_id.as_deref() == Some(task_id))
}

/// Rebuild the tray menu with current state
pub fn rebuild_tray_menu(app: &tauri::AppHandle, tray_state: &TrayState) -> Result<(), String> {
    let tray = app.tray_by_id("rust-tray")
        .ok_or("Tray not found")?;
    
    let running = tray_state.get_running_processes();
    let favorites = tray_state.get_favorite_tasks();
    let recent = tray_state.get_recent_tasks();
    
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
    
    // Recent tasks section (like VSCode's recent projects in dock)
    if !recent.is_empty() {
        let recent_label = MenuItem::with_id(app, "recent_label", "⏱ 最近运行", false, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&recent_label).map_err(|e| e.to_string())?;
        
        // Show at most 10 recent tasks
        for task in recent.iter().take(10) {
            // Check if this task is currently running
            if let Some(process) = is_task_running(&task.id, &running) {
                // Task is running - show with indicator and submenu for restart/stop
                let run_item = MenuItem::with_id(
                    app, 
                    &format!("run_recent:{}", task.id), 
                    "▶ 运行", 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                
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
                
                let force_stop_item = MenuItem::with_id(
                    app, 
                    &format!("force_stop:{}", process.id), 
                    "✖ 强制停止", 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                
                // Display name with running indicator
                let display_name = format!("● {}", task.name);
                let task_submenu = Submenu::with_items(
                    app,
                    &display_name,
                    true,
                    &[&run_item, &restart_item, &stop_item, &force_stop_item]
                ).map_err(|e| e.to_string())?;
                
                menu.append(&task_submenu).map_err(|e| e.to_string())?;
            } else {
                // Task is not running - simple menu item
                let task_item = MenuItem::with_id(
                    app, 
                    &format!("run_recent:{}", task.id), 
                    &task.name, 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                menu.append(&task_item).map_err(|e| e.to_string())?;
            }
        }
        
        // Separator after recent tasks
        let sep_recent = PredefinedMenuItem::separator(app)
            .map_err(|e| e.to_string())?;
        menu.append(&sep_recent).map_err(|e| e.to_string())?;
    }
    
    // Favorites section
    if !favorites.is_empty() {
        let favorites_label = MenuItem::with_id(app, "favorites_label", "★ 收藏夹", false, None::<&str>)
            .map_err(|e| e.to_string())?;
        menu.append(&favorites_label).map_err(|e| e.to_string())?;
        
        for task in &favorites {
            // Check if this task is currently running
            if let Some(process) = is_task_running(&task.id, &running) {
                // Task is running - show with indicator and submenu for restart/stop
                let run_item = MenuItem::with_id(
                    app, 
                    &format!("run_favorite:{}", task.id), 
                    "▶ 运行", 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                
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
                
                let force_stop_item = MenuItem::with_id(
                    app, 
                    &format!("force_stop:{}", process.id), 
                    "✖ 强制停止", 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                
                // Display name with running indicator
                let display_name = format!("● {}", task.name);
                let task_submenu = Submenu::with_items(
                    app,
                    &display_name,
                    true,
                    &[&run_item, &restart_item, &stop_item, &force_stop_item]
                ).map_err(|e| e.to_string())?;
                
                menu.append(&task_submenu).map_err(|e| e.to_string())?;
            } else {
                // Task is not running - simple menu item
                let task_item = MenuItem::with_id(
                    app, 
                    &format!("run_favorite:{}", task.id), 
                    &task.name, 
                    true, 
                    None::<&str>
                ).map_err(|e| e.to_string())?;
                menu.append(&task_item).map_err(|e| e.to_string())?;
            }
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
