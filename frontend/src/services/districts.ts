// District headquarters, used for weather when GPS is off or denied. Weather is on a
// ~10 km grid, so the district town is close enough for a 3-day blight forecast.
// Sorted by state; tomato and potato growing districts first.
export interface District { id: string; name: string; state: string; lat: number; lon: number }

export const DISTRICTS: District[] = [
  { id: 'pune', name: 'Pune', state: 'Maharashtra', lat: 18.52, lon: 73.86 },
  { id: 'nashik', name: 'Nashik', state: 'Maharashtra', lat: 20.0, lon: 73.79 },
  { id: 'satara', name: 'Satara', state: 'Maharashtra', lat: 17.68, lon: 74.02 },
  { id: 'ahilyanagar', name: 'Ahilyanagar (Ahmednagar)', state: 'Maharashtra', lat: 19.09, lon: 74.74 },
  { id: 'kolhapur', name: 'Kolhapur', state: 'Maharashtra', lat: 16.7, lon: 74.24 },
  { id: 'sangli', name: 'Sangli', state: 'Maharashtra', lat: 16.85, lon: 74.58 },
  { id: 'solapur', name: 'Solapur', state: 'Maharashtra', lat: 17.66, lon: 75.91 },
  { id: 'sambhajinagar', name: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', lat: 19.88, lon: 75.34 },
  { id: 'jalgaon', name: 'Jalgaon', state: 'Maharashtra', lat: 21.01, lon: 75.56 },
  { id: 'nagpur', name: 'Nagpur', state: 'Maharashtra', lat: 21.15, lon: 79.09 },
  { id: 'amravati', name: 'Amravati', state: 'Maharashtra', lat: 20.93, lon: 77.75 },
  { id: 'latur', name: 'Latur', state: 'Maharashtra', lat: 18.4, lon: 76.57 },
  { id: 'nanded', name: 'Nanded', state: 'Maharashtra', lat: 19.15, lon: 77.31 },
  { id: 'thane', name: 'Thane', state: 'Maharashtra', lat: 19.22, lon: 72.98 },
  { id: 'agra', name: 'Agra', state: 'Uttar Pradesh', lat: 27.18, lon: 78.01 },
  { id: 'farrukhabad', name: 'Farrukhabad', state: 'Uttar Pradesh', lat: 27.39, lon: 79.58 },
  { id: 'kannauj', name: 'Kannauj', state: 'Uttar Pradesh', lat: 27.06, lon: 79.92 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.85, lon: 80.95 },
  { id: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.32, lon: 82.99 },
  { id: 'hooghly', name: 'Hooghly', state: 'West Bengal', lat: 22.9, lon: 88.39 },
  { id: 'bardhaman', name: 'Purba Bardhaman', state: 'West Bengal', lat: 23.23, lon: 87.86 },
  { id: 'nalanda', name: 'Nalanda', state: 'Bihar', lat: 25.2, lon: 85.52 },
  { id: 'patna', name: 'Patna', state: 'Bihar', lat: 25.59, lon: 85.14 },
  { id: 'jalandhar', name: 'Jalandhar', state: 'Punjab', lat: 31.33, lon: 75.58 },
  { id: 'ludhiana', name: 'Ludhiana', state: 'Punjab', lat: 30.9, lon: 75.85 },
  { id: 'hisar', name: 'Hisar', state: 'Haryana', lat: 29.15, lon: 75.72 },
  { id: 'banaskantha', name: 'Banaskantha', state: 'Gujarat', lat: 24.17, lon: 72.43 },
  { id: 'anand', name: 'Anand', state: 'Gujarat', lat: 22.56, lon: 72.95 },
  { id: 'indore', name: 'Indore', state: 'Madhya Pradesh', lat: 22.72, lon: 75.86 },
  { id: 'gwalior', name: 'Gwalior', state: 'Madhya Pradesh', lat: 26.22, lon: 78.18 },
  { id: 'kolar', name: 'Kolar', state: 'Karnataka', lat: 13.14, lon: 78.13 },
  { id: 'hassan', name: 'Hassan', state: 'Karnataka', lat: 13.0, lon: 76.1 },
  { id: 'belagavi', name: 'Belagavi', state: 'Karnataka', lat: 15.85, lon: 74.5 },
  { id: 'chittoor', name: 'Chittoor', state: 'Andhra Pradesh', lat: 13.22, lon: 79.1 },
  { id: 'rangareddy', name: 'Ranga Reddy', state: 'Telangana', lat: 17.39, lon: 78.49 },
  { id: 'krishnagiri', name: 'Krishnagiri', state: 'Tamil Nadu', lat: 12.52, lon: 78.21 },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.02, lon: 76.96 },
  { id: 'shimla', name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1, lon: 77.17 },
  { id: 'khordha', name: 'Khordha', state: 'Odisha', lat: 20.3, lon: 85.82 },
];

export const districtById = (id: string | null | undefined) => DISTRICTS.find((d) => d.id === id) ?? null;
