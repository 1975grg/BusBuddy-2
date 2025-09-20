import { AccessCodeGenerator } from '../AccessCodeGenerator';

export default function AccessCodeGeneratorExample() {
  return (
    <div className="max-w-md">
      <AccessCodeGenerator 
        routeName="Main Campus Shuttle"
        organizationName="Springfield University"
      />
    </div>
  );
}