import {inject, TestBed} from '@angular/core/testing';

import {VoteService} from './vote.service';

describe('VoteService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VoteService]
    });
  });

  it('should ...', inject([VoteService], (service: VoteService) => {
    expect(service).toBeTruthy();
  }));
});