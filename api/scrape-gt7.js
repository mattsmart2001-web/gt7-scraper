const playwright = require('playwright-chromium');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      return res.status(400).json({ error: 'Profile URL is required' });
    }

    console.log('Scraping GT7 profile:', profileUrl);

    // Launch browser
    browser = await playwright.chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Navigate to profile
    await page.goto(profileUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Extract stats
    const stats = await page.evaluate(() => {
      const allText = document.body.innerText;

      // Extract DR and SR
      const drMatch = allText.match(/Driver\s+Rating[^\w]*([ABCDE]\+?)/i);
      const srMatch = allText.match(/Sportsmanship\s+Rating[^\w]*([SABCDE])/i);

      // Extract race stats
      const findNumberAfterLabel = (label) => {
        const regex = new RegExp(label + '[^\\d]+(\\d[\\d,]*)', 'i');
        const match = allText.match(regex);
        return match ? match[1].replace(/,/g, '') : '0';
      };

      const parseNum = (str) => parseInt(String(str).replace(/[,\s]/g, '')) || 0;

      return {
        driverRating: drMatch ? drMatch[1].toUpperCase() : 'E',
        sportsmanshipRating: srMatch ? srMatch[1].toUpperCase() : 'E',
        races: parseNum(findNumberAfterLabel('Races')),
        victories: parseNum(findNumberAfterLabel('Victories')),
        polePositions: parseNum(findNumberAfterLabel('Pole Positions?')),
        fastestLaps: parseNum(findNumberAfterLabel('Fastest Laps?')),
      };
    });

    await browser.close();

    console.log('Scraped stats:', stats);

    return res.status(200).json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Scraping error:', error);

    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to scrape profile',
      message: error.message,
    });
  }
};
