const mongoose = require('mongoose');
const uri = 'mongodb://anshusharma42019:Anshu42019@ac-ciebiwm-shard-00-00.bubhmal.mongodb.net:27017,ac-ciebiwm-shard-00-01.bubhmal.mongodb.net:27017,ac-ciebiwm-shard-00-02.bubhmal.mongodb.net:27017/Library-SS?ssl=true&replicaSet=atlas-11ogd0-shard-0&authSource=admin&retryWrites=true&w=majority';

console.log('Testing direct MongoDB connection...');
mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('✅ Connection SUCCESSFUL! The IP is whitelisted.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection FAILED:', err.message);
    process.exit(1);
  });
