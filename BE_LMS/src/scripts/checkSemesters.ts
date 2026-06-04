import mongoose from 'mongoose';
import { MONGO_URI } from '../constants/env';
import SemesterModel from '../models/semester.model';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
  const semesters = await SemesterModel.find().lean();
  console.log('Semesters in DB:', JSON.stringify(semesters, null, 2));
  await mongoose.disconnect();
}

main().catch(console.error);
