import { Typography, Button, Space } from '@douyinfe/semi-ui';
import { IconArrowLeft } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';

const { Title } = Typography;

interface ResponsivePageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  extra?: React.ReactNode;
  showBack?: boolean;
}

export default function ResponsivePageHeader({
  title,
  subtitle,
  onBack,
  extra,
  showBack = false,
}: ResponsivePageHeaderProps) {
  const navigate = useNavigate();
  const { isMobile } = useMediaQuery();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {(showBack || onBack) && (
            <Button
              icon={<IconArrowLeft />}
              type="tertiary"
              size="small"
              onClick={handleBack}
            />
          )}
          <Title heading={5} style={{ margin: 0 }}>
            {title}
          </Title>
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
            {subtitle}
          </div>
        )}
        {extra && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {extra}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div>
        <Title heading={4}>{title}</Title>
        {subtitle && (
          <div style={{ fontSize: 14, color: 'var(--semi-color-text-2)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {extra && <Space>{extra}</Space>}
    </div>
  );
}
