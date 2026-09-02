// Runs once before the suite: tops up the saved access token so a single
// manual login stays usable for a working day.
const { refreshAuth } = require('./refresh-auth');

module.exports = async () => {
  await refreshAuth({ quiet: false });
};
