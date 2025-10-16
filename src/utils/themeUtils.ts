// 主题操作工具函数

// 强制在所有浮动组件上应用主题
export const forceThemeOnFloatingComponents = (effectiveTheme: string, nextTick: Function) => {
  nextTick(() => {
    const isLightTheme = effectiveTheme === "light";
    const bgColor = isLightTheme ? "#ffffff" : "#000000";

    // Apply theme to all existing dialogs
    const dialogs = document.querySelectorAll('[role="dialog"]');
    dialogs.forEach((dialog) => {
      const dialogElement = dialog as HTMLElement;
      dialogElement.style.setProperty("background-color", bgColor, "important");

      const content = dialogElement.querySelector(
        ".n-dialog__content"
      ) as HTMLElement;
      const body = dialogElement.querySelector(
        ".n-dialog__body"
      ) as HTMLElement;

      if (content) {
        content.style.setProperty("background-color", bgColor, "important");
      }
      if (body) {
        body.style.setProperty("background-color", bgColor, "important");
      }
    });

    // Apply theme to all dropdown menus
    const dropdowns = document.querySelectorAll(".n-dropdown-menu");
    dropdowns.forEach((dropdown) => {
      const dropdownElement = dropdown as HTMLElement;
      dropdownElement.style.setProperty(
        "background-color",
        bgColor,
        "important"
      );
    });

    // Apply theme to all popovers
    const popovers = document.querySelectorAll(".n-popover");
    popovers.forEach((popover) => {
      const popoverElement = popover as HTMLElement;
      popoverElement.style.setProperty(
        "background-color",
        bgColor,
        "important"
      );
    });

    // Apply theme to all tooltips
    const tooltips = document.querySelectorAll(".n-tooltip");
    tooltips.forEach((tooltip) => {
      const tooltipElement = tooltip as HTMLElement;
      tooltipElement.style.setProperty(
        "background-color",
        bgColor,
        "important"
      );
    });

    // Apply theme to console output containers
    const consoleContainers = document.querySelectorAll(
      ".console-output-container"
    );
    consoleContainers.forEach((container) => {
      const containerElement = container as HTMLElement;
      containerElement.style.setProperty(
        "background-color",
        bgColor,
        "important"
      );
    });

    // Apply theme to console output text
    const consoleOutputs = document.querySelectorAll(".console-output");
    consoleOutputs.forEach((output) => {
      const outputElement = output as HTMLElement;
      const textColor = isLightTheme ? "#000000" : "#ffffff";
      outputElement.style.setProperty("color", textColor, "important");
    });
  });
};