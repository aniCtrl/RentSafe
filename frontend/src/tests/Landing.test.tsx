import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '../app/page';

describe('LandingPage Component', () => {
  test('renders header and CTA button', () => {
    render(<LandingPage />);
    expect(screen.getByText('RENTSAFE.')).toBeInTheDocument();
    expect(screen.getByText('Launch Dashboard')).toBeInTheDocument();
  });
});
