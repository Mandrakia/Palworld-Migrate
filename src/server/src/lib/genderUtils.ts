export function getGenderType(gender?: string): 'male' | 'female' | 'unknown' {
  if (!gender) return 'unknown';
  if (gender === 'EPalGenderType::Male' || gender === 'Male') return 'male';
  if (gender === 'EPalGenderType::Female' || gender === 'Female') return 'female';
  return 'unknown';
}

export function getGenderIcon(gender?: string): string {
  const genderType = getGenderType(gender);
  switch (genderType) {
    case 'male': return '/T_Icon_PanGender_Male.png';
    case 'female': return '/T_Icon_PanGender_Female.png';
    default: return '';
  }
}