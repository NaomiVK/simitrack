import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import {
  ContentSimilarityResult,
  ContentRelationship,
  IntentCluster,
  SimilarityClassification,
} from '@simitrack/shared-types';

@Component({
  selector: 'app-content-similarity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-similarity.component.html',
  styleUrl: './content-similarity.component.scss',
})
export class ContentSimilarityComponent {
  urlInput = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<ContentSimilarityResult | null>(null);
  activeTab = signal<'relationships' | 'clusters'>('relationships');

  relationships = computed(() => this.result()?.relationships ?? []);
  clusters = computed(() => this.result()?.intent_collision_clusters ?? []);

  // Filter relationships by classification
  duplicates = computed(() =>
    this.relationships().filter(
      (r) =>
        r.classification === 'Definite Duplicate' ||
        r.classification === 'Near Duplicate'
    )
  );
  collisions = computed(() =>
    this.relationships().filter((r) => r.classification === 'Intent Collision')
  );
  templateOverlaps = computed(() =>
    this.relationships().filter((r) => r.classification === 'Template Overlap')
  );
  unique = computed(() =>
    this.relationships().filter((r) => r.classification === 'Unique')
  );

  constructor(private apiService: ApiService) {}

  analyze() {
    const urls = this.urlInput()
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (urls.length < 2) {
      this.error.set('Please enter at least 2 valid URLs (starting with http)');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.apiService.analyzeUrls(urls).subscribe({
      next: (response) => {
        if (response.success) {
          this.result.set(response.data);
        } else {
          this.error.set(response.error || 'Analysis failed');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'An error occurred');
        this.loading.set(false);
      },
    });
  }

  loadExample() {
    this.urlInput.set(`https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit.html
https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4114/canada-child-benefit.html
https://www.canada.ca/en/services/taxes/child-and-family-benefits.html`);
  }

  clear() {
    this.urlInput.set('');
    this.result.set(null);
    this.error.set(null);
  }

  getClassificationClass(classification: SimilarityClassification): string {
    switch (classification) {
      case 'Definite Duplicate':
        return 'badge-critical';
      case 'Near Duplicate':
        return 'badge-high';
      case 'Intent Collision':
        return 'badge-medium';
      case 'Template Overlap':
        return 'badge-low';
      default:
        return 'badge-unique';
    }
  }

  truncateUrl(url: string, maxLength = 60): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
}
