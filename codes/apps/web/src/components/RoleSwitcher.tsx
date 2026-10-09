import React from 'react';
import { getDictionary, Language } from '../../../../packages/i18n/src/index';

export type ActiveRole = 'patient' | 'receptionist' | 'doctor' | 'service' | 'cashier' | 'admin';

interface Props {
  activeRole: ActiveRole;
  onRoleChange: (role: ActiveRole) => void;
  lang: Language;
}

export const RoleSwitcher: React.FC<Props> = ({ activeRole, onRoleChange, lang }) => {
  const t = getDictionary(lang);

  const roles: { key: ActiveRole; label: string; icon: string }[] = [
    { key: 'patient', label: t.roles.patient, icon: '👤' },
    { key: 'receptionist', label: t.roles.receptionist, icon: '📋' },
    { key: 'doctor', label: t.roles.doctor, icon: '🩺' },
    { key: 'service', label: t.roles.serviceStaff, icon: '🔬' },
    { key: 'cashier', label: t.roles.cashier, icon: '💳' },
    { key: 'admin', label: t.roles.admin, icon: '⚙️' }
  ];

  return (
    <div className="role-switcher" role="tablist" aria-label="Role Switcher">
      {roles.map(r => (
        <button
          key={r.key}
          id={`role-btn-${r.key}`}
          className={`role-btn ${activeRole === r.key ? 'active' : ''}`}
          onClick={() => onRoleChange(r.key)}
          type="button"
        >
          <span style={{ marginRight: '4px' }}>{r.icon}</span>
          {r.label}
        </button>
      ))}
    </div>
  );
};
