import {Injectable} from '@angular/core';
import {AngularFireAuth, AngularFireDatabase, AuthMethods, AuthProviders, FirebaseAuthState} from 'angularfire2';
import {BehaviorSubject, Observable, Observer, Subject} from 'rxjs';
import {EmailSignupData, parseSessionUser, SessionUser, UserAddress} from '../models/user';
import {FirebaseError} from 'firebase/app';
import {
  AUTH_ERRORED,
  AUTH_STATE_CHANGED,
  AuthErroredAction,
  AuthStateChangedAction,
  SESSION_USER_LOADED,
  SessionUserLoadedAction
} from '../reducers/auth';
import {Store} from '@ngrx/store';
import {AppState, getSessionUser, getSessionUserId} from '../reducers/index';
import {Actions, Effect, toPayload} from '@ngrx/effects';

const DEFAULT_ICON = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/User_font_awesome.svg/500px-User_font_awesome.svg.png';

export type SocialAuthProvider = 'facebook' | 'twitter' | 'google';

export type AuthModalRequestOutcome = 'logged-in' | 'signed-up' | 'none';
export type AuthModalRequest = { message?: string, callback?: (outcome: AuthModalRequestOutcome) => any }

@Injectable()
export class AuthService {

  @Effect()
  loadSessionUserDataEffect: Observable<SessionUserLoadedAction> = this.actions.ofType(AUTH_STATE_CHANGED)
    .map(toPayload)
    .filter(state => !!state && !!state.uid)
    .do(it => {
      console.debug(`initiating loadSessionUserData`);
      console.debug(it);
    })
    .map(state => state.uid)
    .flatMap(id =>
      Observable.combineLatest(this.db.object(`/user/${id}`), this.db.object(`/user_private/${id}`))
      //make sure we end the subscription when the user logs out to avoid 401
        .takeUntil(this.actions.ofType(AUTH_STATE_CHANGED)
          .map(toPayload)
          .filter(it => !it || !it.uid)
        )
        .map(([publicData, privateData]) => parseSessionUser({...publicData, ...privateData, $key: publicData.$key}))
    ).map(user => new SessionUserLoadedAction(user));


  public readonly sessionUser$: Observable<SessionUser | null>;
  public readonly sessionUserId$: Observable<string | null>;

  private authModalReq$: Subject<AuthModalRequest> = new BehaviorSubject(null);
  private verificationRequiredReq$: Subject<any> = new BehaviorSubject(null);

  public readonly displayAuthModal$ = this.authModalReq$.skip(1).share();
  public readonly displayVerificationRequired$ = this.verificationRequiredReq$.skip(1).share();

  constructor(private authBackend: AngularFireAuth,
              private db: AngularFireDatabase,
              private store: Store<AppState>,
              private actions: Actions) {


    this.authBackend
      .distinctUntilChanged()
      .subscribe(state => {
        console.log(state);
        this.store.dispatch(new AuthStateChangedAction(state));
      });


    //whenever the auth state changes, check our user record
    this.authBackend
      .filter(it => !!it && !!it.auth)
      .distinctUntilChanged()
      .flatMap(authState => this.db.object(`/user_private/${authState.uid}`).map(userData => ({authState, userData})))
      .subscribe(it => {
        if (it.authState.auth.emailVerified && !it.userData.isVerified) {
          console.log(`User ${it.authState.uid} has verified their email, updating record accordingly`);
          this.db.object(`/user_private/${it.authState.uid}`).update({isVerified: true}).then(res => {
            console.info(`successfully updated isVerified for user ${it.authState.uid}`);
          });
        }
      });


    this.sessionUserId$ = this.store.select(getSessionUserId);
    this.sessionUser$ = this.store.select(getSessionUser);

  }

  public requestAuthModal(message?: string, callback?: (outcome: AuthModalRequestOutcome) => any) {
    this.authModalReq$.next({message, callback});
  }

  public logout() {
    this.authBackend.logout();
  }

  public emailSignin(data: EmailSignupData): Observable<SessionUser> {

    this.authBackend.createUser({email: data.email, password: data.password})
      .then((state: FirebaseAuthState) => {
      let id = state.uid;
      console.info(`created ${id}`);
      //can't push undefined values
      let addr: UserAddress = {
        line1: data.address.line1,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip
      };

      if (!!data.address.line2) {
        addr.line2 = data.address.line2;
      }

      this.db.object(`/user/${id}`).update({
        firstName: data.firstName,
        lastName: data.lastName,
        icon: DEFAULT_ICON
      }).then(() => {
        console.info(`successfully created user/${id}`);
      }).catch((err) => {
        console.info(`error creating user/${id}`);
        console.info(err);
      });

      console.info('mkay creating private - curr stateL');
      console.info(this.authBackend.getAuth());
      this.db.object(`/user_private/${id}`).update({
        email: data.email,
        address: addr,
        isVerified: false,
      }).then(res => {
        console.info(`successfully created user_private/${id}`)
      }).catch((err) => {
        console.info(`error creating user_private/${id}`);
        console.info(err);
      });

        state.auth.sendEmailVerification().then((res) => {
          console.debug(`sent email`);
          console.debug(res);
        })


    }).catch(err => {
      console.error(`error creating user: ${err.message}`);
    });

    return this.actions.ofType(SESSION_USER_LOADED)
      .take(1)
      .map(toPayload);
  }

  public socialSignIn(provider: SocialAuthProvider): Observable<FirebaseAuthState> {
    this.doSocialLogin(provider);

    return this.actions.ofType(AUTH_STATE_CHANGED)
      .map(action => action.payload)
      .filter(auth => !!auth && !!auth.auth)
      .takeUntil(this.actions.ofType(AUTH_ERRORED));
  }

  public completeSocialSignin(data: UserAddress): Observable<SessionUser> {
    this.sessionUserId$.take(1).subscribe(id => {
      if (!id) {
        throw `Attempted to complete social signin while no sessionUserId exists`;
      }

      this.db.object(`/user_private/${id}`).update({ address: data }).then(res => {
        console.debug(`successfully updated user_private/${id}`);
      });
    });

    return this.actions.ofType(SESSION_USER_LOADED)
      .take(1)
      .map(toPayload);

  }

  public showVerificationRequiredModal() {
    this.verificationRequiredReq$.next();
  }

  public resendVerificationEmail(): Observable<'success'> {
    return Observable.create((observer: Observer<'success'>) => {
      this.authBackend.take(1).subscribe(state => {
        if (!state || !state.auth) {
          throw new Error(`Cannot resend activation email with no signed-in user`)
        }
        state.auth.sendEmailVerification().then(() => {
          observer.next('success');
          observer.complete()
        }).catch(err => {
          observer.error(err);
        })
      })
    }).take(1);
  }


  private doSocialLogin(provider: SocialAuthProvider): void {
    let arg = provider == 'facebook' ? {
      provider: providerMap[ provider ],
      method: AuthMethods.Popup,
      scope: [ 'email' ]
    } : {
      provider: providerMap[ provider ],
      method: AuthMethods.Popup,
    };
    this.authBackend.login(arg).then((it: FirebaseAuthState) => {

    }).catch((err: FirebaseError) => {
      this.store.dispatch(new AuthErroredAction(err));
    });
  }


  private loadSessionUser() {


  }


}


const providerMap: { [x: string]: AuthProviders } = {
  'facebook': AuthProviders.Facebook,
  'twitter': AuthProviders.Twitter,
  'google': AuthProviders.Google,
};
