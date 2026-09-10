import { User } from '../../types';

export const MOCK_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'user-001',
    name: 'Khách Du Lịch Demo',
    email: 'tourist@example.com',
    passwordHash: 'demo123',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'user-002',
    name: 'Trần Tiến Phát',
    email: 'phat.tran@sgu.edu.vn',
    passwordHash: '123456',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    createdAt: '2026-02-01T10:30:00Z',
  },
];
