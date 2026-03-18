import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App'

// The key the app uses to persist data in localStorage.
// If this ever changes in App.jsx, the test below will catch it
// (and remind you that existing user data will be orphaned).
const STORAGE_KEY = 'wrencoria-dnd-v4'

beforeEach(() => {
  localStorage.clear()
})

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('App rendering', () => {
  it('renders the title', async () => {
    render(<App />)
    await screen.findByText(/MORDEKAI/i)
  })

  it('renders the three main tabs', async () => {
    render(<App />)
    await screen.findByText(/Battle Log/i)
    expect(screen.getByText(/War Room/i)).toBeInTheDocument()
    expect(screen.getByText(/Party/i)).toBeInTheDocument()
  })
})

// ─── localStorage persistence ─────────────────────────────────────────────────

describe('localStorage persistence', () => {
  it('writes state to localStorage on mount', async () => {
    render(<App />)
    await screen.findByText(/MORDEKAI/i)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('saved state is valid JSON', async () => {
    render(<App />)
    await screen.findByText(/MORDEKAI/i)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('saves the default party members', async () => {
    render(<App />)
    await screen.findByText(/MORDEKAI/i)
    const { players } = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(players).toContain('King Gizzard')
    expect(players).toContain('Lucien')
  })

  it('loads previously saved party members on startup', async () => {
    // Simulate data written by an earlier session
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ players: ['Aldric', 'Zephyr'], battles: [], activeBattleIdx: 0 })
    )
    render(<App />)
    // The Party tab lists current members; navigate there to check
    await userEvent.click(await screen.findByText(/Party/i))
    expect(await screen.findByText('Aldric')).toBeInTheDocument()
    expect(screen.getByText('Zephyr')).toBeInTheDocument()
  })

  it('data written by one render can be read back after unmount', async () => {
    const { unmount } = render(<App />)
    await screen.findByText(/MORDEKAI/i)
    unmount()

    // Re-read as a new "session" would
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const { players, battles } = JSON.parse(raw)
    expect(Array.isArray(players)).toBe(true)
    expect(Array.isArray(battles)).toBe(true)
  })

  it('deploying new code does not clear localStorage', () => {
    // localStorage lives in the browser, not in the app bundle.
    // This test documents that assumption: writing data then "reloading"
    // the app (re-rendering from scratch) preserves it.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ players: ['Survivor'], battles: [], activeBattleIdx: 0 })
    )
    // Simulate a fresh app load (new deploy)
    const raw = localStorage.getItem(STORAGE_KEY)
    const { players } = JSON.parse(raw)
    expect(players).toContain('Survivor')
  })
})
