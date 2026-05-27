import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from '../TopBar';

const mockUseAppVersion = vi.fn();
const mockUseLastSync = vi.fn();

vi.mock('../../api/meta', () => ({
  FRONTEND_VERSION: '1.17.0',
  useAppVersion: () => mockUseAppVersion(),
}));

vi.mock('../../api/sync', () => ({
  useLastSync: () => mockUseLastSync(),
}));

describe('TopBar', () => {
  it('renders frontend and backend versions next to the sync indicator', () => {
    mockUseLastSync.mockReturnValue({ data: [] });
    mockUseAppVersion.mockReturnValue({
      data: { backend_version: 'v2.3.4' },
    });

    render(<TopBar title="Dashboard" />);

    expect(screen.getByText('FE v1.17.0')).toBeInTheDocument();
    expect(screen.getByText('BE v2.3.4')).toBeInTheDocument();
  });

  it('still renders the frontend version if the backend version is unavailable', () => {
    mockUseLastSync.mockReturnValue({ data: [] });
    mockUseAppVersion.mockReturnValue({ data: undefined });

    render(<TopBar title="Dashboard" />);

    expect(screen.getByText('FE v1.17.0')).toBeInTheDocument();
    expect(screen.queryByText(/^BE /)).not.toBeInTheDocument();
  });
});
