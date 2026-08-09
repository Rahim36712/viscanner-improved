import App from './App';

describe('App component', () => {
  test('is defined and exports a React component function', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});
