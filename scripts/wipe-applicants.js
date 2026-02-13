require('dotenv').config();
const sequelize = require('../models/database');
const Applicant = require('../models/Applicant');

(async () => {
  try {
    await sequelize.authenticate();
    const before = await Applicant.count();
    const deleted = await Applicant.destroy({ where: {}, truncate: true });
    const after = await Applicant.count();
    console.log(JSON.stringify({ before, deleted, after }));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
