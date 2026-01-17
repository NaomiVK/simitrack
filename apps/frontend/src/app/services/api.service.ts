import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ContentSimilarityResult,
  AnalyzeUrlsRequest,
} from '@simitrack/shared-types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  analyzeUrls(
    urls: string[]
  ): Observable<ApiResponse<ContentSimilarityResult>> {
    const request: AnalyzeUrlsRequest = { urls };
    return this.http.post<ApiResponse<ContentSimilarityResult>>(
      `${this.apiUrl}/content-similarity/analyze`,
      request
    );
  }

  getStatus(): Observable<ApiResponse<{ ready: boolean; message: string }>> {
    return this.http.get<ApiResponse<{ ready: boolean; message: string }>>(
      `${this.apiUrl}/content-similarity/status`
    );
  }
}
