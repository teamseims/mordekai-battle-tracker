import '@testing-library/jest-dom'

// recharts uses ResizeObserver internally; jsdom doesn't have it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
