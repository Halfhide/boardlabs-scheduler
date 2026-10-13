// Chooses a 'yyyy-MM-dd' day through the MeppleTime DatePicker UI
// (src/components/shared/DatePicker.jsx), like a person would.
export async function pickDate(page, id, iso) {
  const wrapper = `#${id} + [role="dialog"]`;
  await page.waitForSelector('#splash', { hidden: true });
  await page.click(`#${id}`);
  await page.waitForSelector(wrapper);
  for (let i = 0; i < 60; i++) {
    const shown = await page.$eval(wrapper, el => el.dataset.month);
    if (shown === iso.slice(0, 7)) break;
    const label = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"][data-month] button[aria-label]')].map(b => b.getAttribute('aria-label')));
    await page.click(`${wrapper} button[aria-label="${shown < iso.slice(0, 7) ? label[1] : label[0]}"]`);
  }
  await page.click(`${wrapper} [data-date="${iso}"]`);
  await page.waitForSelector(wrapper, { hidden: true });
}
