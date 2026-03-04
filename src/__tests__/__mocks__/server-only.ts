// Mock for 'server-only' package in test environment.
// The real package throws if imported from a client bundle.
// In tests, we just need it to be a no-op.
export {};
