const mongoose = require('mongoose');

const WorkScheduleSchema = new mongoose.Schema({
    year: Number,
    month: Number,
    dates: [Date],
    teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
});

WorkScheduleSchema.methods.addDate = function (date) {
    const hasDate = this.dates.some((existingDate) => {
        return existingDate.getTime() === date.getTime();
    });
    if (hasDate) {
        throw new Error('The date already exists in the work schedule for this month.');
    } else {
        this.dates.push(date);
        this.dates.sort((a, b) => a - b);
    }
};

WorkScheduleSchema.methods.removeDate = function (date) {
    const dateIndex = this.dates.findIndex((item) => item.getTime() === date.getTime());

    if (dateIndex !== -1) {
        this.dates.splice(dateIndex, 1);
    }
};

module.exports = WorkScheduleSchema;