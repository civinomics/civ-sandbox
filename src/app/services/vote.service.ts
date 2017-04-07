import {Injectable} from '@angular/core';
import * as moment from 'moment';
import {AuthService} from './auth.service';
import {AngularFireDatabase} from 'angularfire2';
import {Observable} from 'rxjs';
import {parseVote, Vote} from '../models/vote';
import {SessionUser} from '../models/user';

@Injectable()
export class VoteService {

  constructor(private authService: AuthService, private db: AngularFireDatabase) {

  }

  public castVote(itemId: string, value: 1 | -1) {
    console.log('voting');
    this.authService.sessionUser$.take(1).subscribe(user => {
      if (!user) {
        console.debug('no user signed in - opening modal');
        this.authService.requestAuthModal('We need you to sign in before voting.', (result) => {
          setTimeout(() => {
            console.debug(`modal callback - result ${result} : casting again`);
            this.castVote(itemId, value);
          }, 1000);
        });
        return;
      }


      this.getUserVoteFor(itemId).take(1).subscribe(extantVote => {
        if (extantVote == null) {
          this.castNewVote(itemId, value, user);
        } else if (extantVote.value == value) {
          this.deleteVote(itemId, extantVote.id, user.id);
        } else {
          this.changeVote(itemId, extantVote.id, value);
        }
      })


    })
  }

  private changeVote(itemId: string, voteId: string, value: 1 | -1) {
    console.log(`changing vote ${itemId}/${voteId}`);
    this.db.object(`/vote/${itemId}/${voteId}`).update({value, posted: moment().toISOString()}).then(res => {

    }).catch(err => {
      console.error(`error updating vote ${itemId}/${voteId}: ${err.message}`);
    })
  }

  private castNewVote(itemId: string, value: 1 | -1, user: SessionUser) {
    console.log(`casting new vote`);
    let userDistrict = user.districts ? user.districts['id_acc'] : null;

    this.db.list(`/vote/${itemId}`).push({
      value,
      owner: user.id,
      userDistrict,
      posted: moment().toISOString()
    }).then(result => {
      let voteId = result.key;
      console.log(`vote created with ID ${voteId}`);
      this.db.object(`/user_private/${user.id}/votes`).update({[itemId]: voteId}).then(() => {
        console.log(`vote ${voteId} added to user_private/${user.id}`)
      })
    }).catch(err => {
      console.error(`error casting vote: ${err.message}`)
    })
  }

  private deleteVote(itemId: string, voteId: string, userId: string) {
    console.info(`deleting vote ${itemId}/${voteId}`);
    this.db.object(`/vote/${itemId}/${voteId}`).remove()
      .then(() => console.info(`successfully deleted /vote/${itemId}/${voteId}`))
      .catch((err) => `error deleting vote: ${err.message}`);
    this.db.object(`/user_private/${userId}/votes/${itemId}`).remove()
      .then(() => console.info(`successfully deleted /user_private/${userId}/votes/${voteId}`))
      .catch((err) => `error deleting user vote entry: ${err.message}`);
  }

  getUserVoteFor(itemId: string): Observable<Vote | null> {
    console.log(`getting user vote for ${itemId}`);
    let userVoteId: Observable<string | null> = this.authService.sessionUserId$.flatMap(userId =>
      !userId ? Observable.of(null) : this.db.object(`/user_private/${userId}/votes/${itemId}`).map(it =>
        !it ? null : it.$value)
    );

    return userVoteId
      .flatMap(it => it == null ? Observable.of(null) : this.db.object(`/vote/${itemId}/${it}`).map(it => parseVote(it)));

  }

}
