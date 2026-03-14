import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageAnimation } from '@/hooks/use-page-animation';

const Settings = () => {
  const navigate = useNavigate();
  const { shouldAnimate } = usePageAnimation('Settings');

  useEffect(() => {
    navigate('/settings/profile', { replace: true });
  }, [navigate]);

  return null;
};

export default Settings;
