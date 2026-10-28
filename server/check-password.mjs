import bcrypt from 'bcryptjs';

const hash = '$2a$10$KrAB0ezBRGSGUWQ3uyqnnu5Z9wwk7sde0PibYRJyS15fM38IyR6vq';

console.log(
  'Password123! matches:',
  await bcrypt.compare('Password123!', hash)
);
