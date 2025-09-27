import QRCode from 'qrcode';
import { Route } from '@shared/schema';

export class QrService {
  /**
   * Generate QR code URL for a route
   * This creates a link that riders can scan to access the route dashboard
   */
  generateRouteUrl(route: Route, organizationId: string): string {
    const baseUrl = process.env.REPLIT_DOMAIN 
      ? `https://${process.env.REPLIT_DOMAIN}` 
      : 'http://localhost:5000';
    
    return `${baseUrl}/ride/${organizationId}/${route.id}`;
  }

  /**
   * Generate QR code as Data URL (base64 image)
   */
  async generateQrCode(url: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('QR code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code for a route
   */
  async generateRouteQrCode(route: Route, organizationId: string): Promise<string> {
    const url = this.generateRouteUrl(route, organizationId);
    return this.generateQrCode(url);
  }

  /**
   * Generate printable QR code with route information
   */
  async generatePrintableQrCode(route: Route, organizationId: string, organizationName: string): Promise<{
    qrCodeDataUrl: string;
    url: string;
    routeName: string;
    organizationName: string;
  }> {
    const url = this.generateRouteUrl(route, organizationId);
    const qrCodeDataUrl = await this.generateQrCode(url);
    
    return {
      qrCodeDataUrl,
      url,
      routeName: route.name,
      organizationName
    };
  }
}

// Export singleton instance
export const qrService = new QrService();