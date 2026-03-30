import { Button } from '@douyinfe/semi-ui';
import { IconMoon, IconSun } from '@douyinfe/semi-icons';
import { useThemeStore } from '../stores/themeStore';

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeStore();

  return (
    <Button
      theme="borderless"
      icon={mode === 'light' ? <IconMoon /> : <IconSun />}
      onClick={toggleMode}
      style={{
        color: 'var(--semi-color-text-2)',
        borderRadius: 8,
      }}
    >
      {mode === 'light' ? '深色' : '浅色'}
    </Button>
  );
}
