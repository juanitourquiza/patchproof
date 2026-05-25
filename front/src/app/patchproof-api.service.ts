import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  ApiKeyListResponse,
  ApiKeyRecord,
  HealthResponse,
  ProjectListResponse,
  ProjectSummaryEnvelope,
  ProjectSummaryResponse,
  ScanListResponse,
} from './patchproof.types';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PatchProofApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  getHealth(): Promise<HealthResponse> {
    return firstValueFrom(this.http.get<HealthResponse>(`${this.baseUrl}/health`));
  }

  listProjects(): Promise<ProjectListResponse> {
    return firstValueFrom(this.http.get<ProjectListResponse>(`${this.baseUrl}/projects`));
  }

  getProjectSummary(projectId: number): Promise<ProjectSummaryResponse> {
    return firstValueFrom(
      this.http.get<ProjectSummaryEnvelope>(`${this.baseUrl}/projects/${projectId}/summary`)
    ).then((response) => response.data);
  }

  listProjectScans(projectId: number, params: Record<string, string | number> = {}): Promise<ScanListResponse> {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }

    return firstValueFrom(
      this.http.get<ScanListResponse>(`${this.baseUrl}/projects/${projectId}/scans`, {
        params: httpParams,
      })
    );
  }

  listProjectApiKeys(projectId: number): Promise<ApiKeyListResponse> {
    return this.listProjectApiKeysWithAdminKey(projectId);
  }

  listProjectApiKeysWithAdminKey(projectId: number, adminKey?: string): Promise<ApiKeyListResponse> {
    return firstValueFrom(
      this.http.get<ApiKeyListResponse>(`${this.baseUrl}/projects/${projectId}/api-keys`, {
        headers: this.buildAdminHeaders(adminKey),
      })
    );
  }

  revokeProjectApiKey(projectId: number, apiKeyId: number, adminKey?: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/projects/${projectId}/api-keys/${apiKeyId}`, {
        headers: this.buildAdminHeaders(adminKey),
      })
    );
  }

  private buildAdminHeaders(adminKey?: string): HttpHeaders | undefined {
    const trimmed = adminKey?.trim();

    if (!trimmed) {
      return undefined;
    }

    return new HttpHeaders({
      'X-PatchProof-Admin-Key': trimmed,
    });
  }
}
