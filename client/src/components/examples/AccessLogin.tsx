import { AccessLogin } from '../AccessLogin';

export default function AccessLoginExample() {
  return (
    <AccessLogin 
      onAccessGranted={(method, value) => console.log('Access granted:', method, value)} 
    />
  );
}