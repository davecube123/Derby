// Philippine cities for sunrise/sunset. All use Philippine time (UTC+8).
export const PH_OFFSET = 8;
export const PH_TZ = 'Asia/Manila';
export const CITIES = [
  ['Manila', 14.5995, 120.9842], ['Quezon City', 14.676, 121.0437], ['Batangas', 13.7565, 121.0583],
  ['Lucena', 13.9373, 121.617], ['San Fernando, Pampanga', 15.0286, 120.6898], ['Baguio', 16.4023, 120.596],
  ['Laoag', 18.1978, 120.5936], ['Tuguegarao', 17.6132, 121.727], ['Legazpi', 13.1391, 123.7438],
  ['Puerto Princesa', 9.7392, 118.7353], ['Iloilo', 10.7202, 122.5621], ['Bacolod', 10.6765, 122.9509],
  ['Cebu', 10.3157, 123.8854], ['Dumaguete', 9.3068, 123.3054], ['Tacloban', 11.2433, 125.0039],
  ['Cagayan de Oro', 8.4542, 124.6319], ['Butuan', 8.9475, 125.5406], ['Davao', 7.1907, 125.4553],
  ['General Santos', 6.1164, 125.1716], ['Zamboanga', 6.9214, 122.079],
].map(([name, lat, lon]) => ({ name, lat, lon }));
