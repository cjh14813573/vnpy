import { useEffect, useCallback, useState } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled: boolean = true) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 如果在输入框中，不触发快捷键（除了 Esc）
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (isInput && event.key !== 'Escape') {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key === shortcut.key || event.code === shortcut.key;
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const altMatch = !!shortcut.alt === event.altKey;
      const shiftMatch = !!shortcut.shift === event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }

    // F1-F4 和 F? 键默认会触发浏览器帮助，需要阻止
    if (event.key.startsWith('F') && !event.ctrlKey && !event.altKey) {
      const fKeyNum = parseInt(event.key.slice(1));
      if (fKeyNum >= 1 && fKeyNum <= 12) {
        const hasShortcut = shortcuts.some(s => s.key === event.key);
        if (hasShortcut) {
          event.preventDefault();
        }
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  // 显示/隐藏帮助
  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  return { showHelp, setShowHelp, toggleHelp };
}

export default useKeyboardShortcuts;
