import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import QRCode from "react-qr-code";
import { Download, Printer } from "lucide-react";
import type { Asset } from "@shared/schema";
import { useRef } from "react";

interface AssetQRModalProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AssetQRModal({ asset, open, onOpenChange }: AssetQRModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  if (!asset) return null;

  const qrValue = `ASSET:${asset.assetTag || 'NO-TAG'}:${asset.id}`;

  const handlePrint = () => {
    const printContent = qrRef.current;
    if (!printContent) return;

    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `Print_${uniqueName}`;
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - ${asset.name}</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              font-family: sans-serif;
            }
            .qr-container { text-align: center; }
            .asset-info { margin-top: 20px; }
            @media print {
              body { height: auto; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${printContent.innerHTML}
            <div class="asset-info">
              <h2>${asset.name}</h2>
              <p><strong>Asset Tag:</strong> ${asset.assetTag || 'N/A'}</p>
              <p><strong>Serial:</strong> ${asset.serialNumber || 'N/A'}</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 120;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        
        ctx.fillStyle = "black";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(asset.name, canvas.width / 2, img.height + 50);
        
        ctx.font = "14px Arial";
        ctx.fillText(`Tag: ${asset.assetTag || 'N/A'}`, canvas.width / 2, img.height + 75);
        ctx.fillText(`Serial: ${asset.serialNumber || 'N/A'}`, canvas.width / 2, img.height + 95);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QR_${asset.assetTag || asset.id}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asset QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <div ref={qrRef} className="bg-white p-4 rounded-lg border">
            <QRCode
              value={qrValue}
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox={`0 0 256 256`}
            />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-bold text-lg">{asset.name}</h3>
            <p className="text-sm text-muted-foreground">Tag: {asset.assetTag || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Serial: {asset.serialNumber || 'N/A'}</p>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
