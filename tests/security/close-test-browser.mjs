// Stop only the disposable Chrome process created by a test runner.
export async function closeTestBrowser(browser) {
  if (!browser) return;
  let timer;
  try {
    await Promise.race([
      browser.close(),
      new Promise(resolve => {
        timer = setTimeout(() => {
          console.log('Chrome cleanup exceeded 15 seconds; stopping the test browser.');
          browser.process()?.kill('SIGKILL');
          browser.disconnect();
          resolve();
        }, 15000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
