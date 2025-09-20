import { LogoUpload } from '../LogoUpload';

export default function LogoUploadExample() {
  return (
    <div className="max-w-md">
      <LogoUpload
        organizationName="Springfield University"
        onLogoUpdate={(url) => console.log('Logo updated:', url)}
      />
    </div>
  );
}