import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  message: string;
  imported?: {
    assets: number;
    employees: number;
    assignments: number;
  };
  errors?: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          title: "Invalid File",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      toast({
        title: "Import Successful",
        description: `Imported ${data.imported.assets} assets, ${data.imported.employees} employees, and ${data.imported.assignments} assignments`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      setResult({
        success: false,
        message: errorMessage,
        errors: [errorMessage],
      });
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4" data-testid="page-import">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Import Data</h1>
          <p className="text-muted-foreground">
            Upload an Excel file to import assets, employees, and assignments
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Excel File Upload</CardTitle>
            <CardDescription>
              Select an Excel file (.xlsx or .xls) containing your asset and employee data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
                disabled={importing}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-4"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium mb-1">
                    {file ? file.name : 'Click to select Excel file'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or drag and drop your file here
                  </p>
                </div>
              </label>
            </div>

            {/* Import Button */}
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full"
              size="lg"
              data-testid="button-import"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </>
              )}
            </Button>

            {/* Expected Format Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Expected Excel Format</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2 text-sm">
                  <p className="font-medium">Your Excel file should have these sheets:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Assets</strong>: name, type, status, serialNumber, purchaseDate, purchasePrice, warrantyExpiry, specifications</li>
                    <li><strong>Employees</strong>: employeeId, firstName, lastName, email, department, position, phone, startDate, salary</li>
                    <li><strong>Assignments</strong> (optional): assetSerialNumber, employeeEmail, assignedDate, returnedDate</li>
                  </ul>
                  <p className="mt-3 text-muted-foreground">
                    Note: The import will match employees by email and assets by serial number for assignments.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Import Result */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                Import {result.success ? 'Successful' : 'Failed'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{result.message}</p>
              {result.success && result.imported && (
                <div className="bg-muted rounded-lg p-4 space-y-2" data-testid="import-result-success">
                  <div className="flex justify-between">
                    <span className="font-medium">Assets Imported:</span>
                    <span className="text-green-600 font-semibold">{result.imported.assets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Employees Imported:</span>
                    <span className="text-green-600 font-semibold">{result.imported.employees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Assignments Imported:</span>
                    <span className="text-green-600 font-semibold">{result.imported.assignments}</span>
                  </div>
                </div>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium mb-2 text-destructive">Errors:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm" data-testid="import-result-errors">
                    {result.errors.map((error, idx) => (
                      <li key={idx} className="text-destructive">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
