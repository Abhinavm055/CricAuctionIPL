import * as real from '@firebase/firestore';

export const MOCK_PLAYERS = [
  { id: "p1", name: "MS Dhoni", role: "Wicket-Keeper", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "csk", pool: "Marquee" },
  { id: "p2", name: "Virat Kohli", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "rcb", pool: "Marquee" },
  { id: "p3", name: "Jasprit Bumrah", role: "Bowler", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "mi", pool: "Marquee" },
  { id: "p4", name: "Heinrich Klaasen", role: "Wicket-Keeper", nationality: "South Africa", isOverseas: true, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "srh", pool: "Wicket-Keepers" },
  { id: "p5", name: "Rashid Khan", role: "Bowler", nationality: "Afghanistan", isOverseas: true, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "gt", pool: "Bowlers" },
  { id: "p6", name: "Sunil Narine", role: "All-Rounder", nationality: "West Indies", isOverseas: true, isCapped: true, basePrice: 15000000, starRating: 5, previousTeamId: "kkr", pool: "All-Rounders" },
  { id: "p7", name: "Pat Cummins", role: "Bowler", nationality: "Australia", isOverseas: true, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "srh", pool: "Bowlers" },
  { id: "p8", name: "Rishabh Pant", role: "Wicket-Keeper", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "dc", pool: "Wicket-Keepers" },
  { id: "p9", name: "Shreyas Iyer", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 4, previousTeamId: "pbks", pool: "Batsmen" },
  { id: "p10", name: "Mitchell Starc", role: "Bowler", nationality: "Australia", isOverseas: true, isCapped: true, basePrice: 20000000, starRating: 4, previousTeamId: "kkr", pool: "Bowlers" },
  { id: "p11", name: "Rinku Singh", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 15000000, starRating: 4, previousTeamId: "kkr", pool: "Batsmen" },
  { id: "p12", name: "Suryakumar Yadav", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "mi", pool: "Batsmen" },
  { id: "p13", name: "Yuzvendra Chahal", role: "Bowler", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 15000000, starRating: 4, previousTeamId: "rr", pool: "Bowlers" },
  { id: "p14", name: "Ravindra Jadeja", role: "All-Rounder", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "csk", pool: "All-Rounders" },
  { id: "p15", name: "Shivam Dube", role: "All-Rounder", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 10000000, starRating: 4, previousTeamId: "csk", pool: "All-Rounders" },
  { id: "p16", name: "Ruturaj Gaikwad", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 15000000, starRating: 4, previousTeamId: "csk", pool: "Batsmen" },
  { id: "p17", name: "Hardik Pandya", role: "All-Rounder", nationality: "Indian", isOverseas: false, isCapped: true, basePrice: 20000000, starRating: 5, previousTeamId: "mi", pool: "All-Rounders" },
  { id: "p18", name: "Matheesha Pathirana", role: "Bowler", nationality: "Sri Lanka", isOverseas: true, isCapped: true, basePrice: 10000000, starRating: 4, previousTeamId: "csk", pool: "Bowlers" },
  { id: "p19", name: "Tushar Deshpande", role: "Bowler", nationality: "Indian", isOverseas: false, isCapped: false, basePrice: 5000000, starRating: 3, previousTeamId: "csk", pool: "Bowlers" },
  { id: "p20", name: "Sameer Rizvi", role: "Batsman", nationality: "Indian", isOverseas: false, isCapped: false, basePrice: 3000000, starRating: 2, previousTeamId: "csk", pool: "Batsmen" }
];

const getDb = () => {
  const data = localStorage.getItem('mock_firestore_db');
  if (!data) {
    const initialDb = {};
    MOCK_PLAYERS.forEach(player => {
      initialDb[`players/${player.id}`] = player;
    });
    localStorage.setItem('mock_firestore_db', JSON.stringify(initialDb));
    return initialDb;
  }
  return JSON.parse(data);
};

const setDb = (dbObj) => {
  localStorage.setItem('mock_firestore_db', JSON.stringify(dbObj));
  window.dispatchEvent(new Event('mock-firestore-update'));
};

const applyUpdateValue = (currentVal, newVal) => {
  if (newVal && newVal._type === 'arrayUnion') {
    const arr = Array.isArray(currentVal) ? [...currentVal] : [];
    newVal.values.forEach(v => {
      if (!arr.includes(v)) arr.push(v);
    });
    return arr;
  }
  if (newVal && newVal._type === 'arrayRemove') {
    const arr = Array.isArray(currentVal) ? [...currentVal] : [];
    return arr.filter(v => !newVal.values.includes(v));
  }
  if (newVal && newVal._type === 'increment') {
    return (Number(currentVal) || 0) + newVal.value;
  }
  if (newVal && newVal._type === 'deleteField') {
    return undefined;
  }
  if (newVal && newVal._type === 'serverTimestamp') {
    return Date.now();
  }
  return newVal;
};

const deepUpdate = (target, source) => {
  const result = { ...target };
  Object.entries(source).forEach(([key, val]) => {
    if (key.includes('.')) {
      const parts = key.split('.');
      let cur = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        cur[p] = { ...cur[p] };
        cur = cur[p];
      }
      const lastKey = parts[parts.length - 1];
      const applied = applyUpdateValue(cur[lastKey], val);
      if (applied === undefined) {
        delete cur[lastKey];
      } else {
        cur[lastKey] = applied;
      }
    } else {
      const applied = applyUpdateValue(result[key], val);
      if (applied === undefined) {
        delete result[key];
      } else {
        result[key] = applied;
      }
    }
  });
  return result;
};

const restoreTimestamps = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    const ms = obj.seconds * 1000 + Math.floor(obj.nanoseconds / 1000000);
    return real.Timestamp.fromMillis(ms);
  }
  if (Array.isArray(obj)) {
    return obj.map(restoreTimestamps);
  }
  const restored: any = {};
  Object.keys(obj).forEach(key => {
    restored[key] = restoreTimestamps(obj[key]);
  });
  return restored;
};

export const getFirestore = (app) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.getFirestore(app);
  }
  return { app };
};

export const collection = (db, path, ...segments) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.collection(db, path, ...segments);
  }
  const fullPath = [path, ...segments].filter(Boolean).join('/');
  return { path: fullPath, isDoc: false, filters: [] };
};

export const doc = (db, path, ...segments) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.doc(db, path, ...segments);
  }
  const fullPath = [path, ...segments].filter(Boolean).join('/');
  return { path: fullPath, isDoc: true };
};

export const query = (colRef, ...constraints) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.query(colRef, ...constraints);
  }
  const q = { ...colRef };
  constraints.forEach(c => {
    if (c.type === 'where') {
      if (!q.filters) q.filters = [];
      q.filters.push(c);
    } else if (c.type === 'orderBy') {
      q.orderByField = c.field;
      q.orderByDir = c.direction;
    }
  });
  return q;
};

export const where = (field, op, value) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.where(field, op, value);
  }
  return { type: 'where', field, op, value };
};

export const orderBy = (field, direction = 'asc') => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.orderBy(field, direction);
  }
  return { type: 'orderBy', field, direction };
};

export const limit = (n) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.limit(n);
  }
  return { type: 'limit', value: n };
};

export const onSnapshot = (q, next, error) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.onSnapshot(q, next, error);
  }

  const runCallback = () => {
    const path = q.path;
    const isDoc = q.isDoc;
    const dbObj = getDb();
    
    if (isDoc) {
      const docData = dbObj[path] || null;
      next({
        exists: () => docData !== null,
        id: path.split('/').pop(),
        data: () => docData ? restoreTimestamps(JSON.parse(JSON.stringify(docData))) : undefined
      });
    } else {
      const docs = [];
      Object.entries(dbObj).forEach(([docPath, data]) => {
        const parts = docPath.split('/');
        const docId = parts.pop();
        const parentPath = parts.join('/');
        if (parentPath === path) {
          let matches = true;
          if (q.filters) {
            for (const filter of q.filters) {
              const val = data[filter.field];
              if (filter.op === '==') {
                if (val !== filter.value) matches = false;
              }
            }
          }
          if (matches) {
            docs.push({
              id: docId,
              data: () => restoreTimestamps(JSON.parse(JSON.stringify(data)))
            });
          }
        }
      });

      if (q.orderByField) {
        docs.sort((a, b) => {
          const valA = a.data()[q.orderByField];
          const valB = b.data()[q.orderByField];
          const desc = q.orderByDir === 'desc';
          if (valA < valB) return desc ? 1 : -1;
          if (valA > valB) return desc ? -1 : 1;
          return 0;
        });
      }

      next({
        docs,
        forEach: (cb) => docs.forEach(cb)
      });
    }
  };

  setTimeout(runCallback, 0);

  const listener = () => {
    runCallback();
  };

  window.addEventListener('mock-firestore-update', listener);
  window.addEventListener('storage', listener);

  return () => {
    window.removeEventListener('mock-firestore-update', listener);
    window.removeEventListener('storage', listener);
  };
};

export const updateDoc = async (docRef, updates) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.updateDoc(docRef, updates);
  }
  const dbObj = getDb();
  const current = dbObj[docRef.path] || {};
  dbObj[docRef.path] = deepUpdate(current, updates);
  setDb(dbObj);
};

export const setDoc = async (docRef, data, options) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.setDoc(docRef, data, options);
  }
  const dbObj = getDb();
  const current = dbObj[docRef.path] || {};
  if (options && options.merge) {
    dbObj[docRef.path] = deepUpdate(current, data);
  } else {
    const processed = {};
    Object.entries(data).forEach(([k, v]) => {
      processed[k] = applyUpdateValue(undefined, v);
    });
    dbObj[docRef.path] = processed;
  }
  setDb(dbObj);
};

export const addDoc = async (colRef, data) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.addDoc(colRef, data);
  }
  const dbObj = getDb();
  const docId = Math.random().toString(36).substring(2, 15);
  const docPath = `${colRef.path}/${docId}`;
  const processed = {};
  Object.entries(data).forEach(([k, v]) => {
    processed[k] = applyUpdateValue(undefined, v);
  });
  dbObj[docPath] = processed;
  setDb(dbObj);
  return { id: docId, path: docPath };
};

export const deleteDoc = async (docRef) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.deleteDoc(docRef);
  }
  const dbObj = getDb();
  delete dbObj[docRef.path];
  setDb(dbObj);
};

export const arrayUnion = (...values) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.arrayUnion(...values);
  }
  return { _type: 'arrayUnion', values };
};

export const arrayRemove = (...values) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.arrayRemove(...values);
  }
  return { _type: 'arrayRemove', values };
};

export const increment = (value) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.increment(value);
  }
  return { _type: 'increment', value };
};

export const deleteField = () => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.deleteField();
  }
  return { _type: 'deleteField' };
};

export const serverTimestamp = () => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.serverTimestamp();
  }
  return { _type: 'serverTimestamp' };
};

export const runTransaction = async (db, updateFunction) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.runTransaction(db, updateFunction);
  }

  const tx = {
    get: async (docRef) => {
      const dbObj = getDb();
      const data = dbObj[docRef.path] || null;
      return {
        exists: () => data !== null,
        data: () => data ? restoreTimestamps(JSON.parse(JSON.stringify(data))) : undefined,
        id: docRef.path.split('/').pop()
      };
    },
    update: (docRef, updates) => {
      const dbObj = getDb();
      const current = dbObj[docRef.path] || {};
      dbObj[docRef.path] = deepUpdate(current, updates);
      setDb(dbObj);
    },
    set: (docRef, data, options) => {
      const dbObj = getDb();
      const current = dbObj[docRef.path] || {};
      if (options && options.merge) {
        dbObj[docRef.path] = deepUpdate(current, data);
      } else {
        const processed = {};
        Object.entries(data).forEach(([k, v]) => {
          processed[k] = applyUpdateValue(undefined, v);
        });
        dbObj[docRef.path] = processed;
      }
      setDb(dbObj);
    },
    delete: (docRef) => {
      const dbObj = getDb();
      delete dbObj[docRef.path];
      setDb(dbObj);
    }
  };

  return updateFunction(tx);
};

export const writeBatch = (db) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.writeBatch(db);
  }

  const ops = [];
  return {
    update: (docRef, updates) => {
      ops.push({ type: 'update', docRef, data: updates });
    },
    set: (docRef, data, options) => {
      ops.push({ type: 'set', docRef, data, options });
    },
    delete: (docRef) => {
      ops.push({ type: 'delete', docRef });
    },
    commit: async () => {
      const dbObj = getDb();
      ops.forEach(op => {
        if (op.type === 'update') {
          const current = dbObj[op.docRef.path] || {};
          dbObj[op.docRef.path] = deepUpdate(current, op.data);
        } else if (op.type === 'set') {
          const current = dbObj[op.docRef.path] || {};
          if (op.options && op.options.merge) {
            dbObj[op.docRef.path] = deepUpdate(current, op.data);
          } else {
            const processed = {};
            Object.entries(op.data).forEach(([k, v]) => {
              processed[k] = applyUpdateValue(undefined, v);
            });
            dbObj[op.docRef.path] = processed;
          }
        } else if (op.type === 'delete') {
          delete dbObj[op.docRef.path];
        }
      });
      setDb(dbObj);
    }
  };
};

export const getDoc = async (docRef) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.getDoc(docRef);
  }
  const dbObj = getDb();
  const data = dbObj[docRef.path] || null;
  return {
    exists: () => data !== null,
    id: docRef.path.split('/').pop(),
    data: () => data ? restoreTimestamps(JSON.parse(JSON.stringify(data))) : undefined
  };
};

export const getDocs = async (q) => {
  if (localStorage.getItem('useMockFirebase') !== 'true') {
    return real.getDocs(q);
  }
  const path = q.path;
  const dbObj = getDb();
  const docs = [];
  Object.entries(dbObj).forEach(([docPath, data]) => {
    const parts = docPath.split('/');
    const docId = parts.pop();
    const parentPath = parts.join('/');
    if (parentPath === path) {
      let matches = true;
      if (q.filters) {
        for (const filter of q.filters) {
          const val = data[filter.field];
          if (filter.op === '==') {
            if (val !== filter.value) matches = false;
          }
        }
      }
      if (matches) {
        docs.push({
          id: docId,
          data: () => restoreTimestamps(JSON.parse(JSON.stringify(data)))
        });
      }
    }
  });

  return {
    empty: docs.length === 0,
    docs,
    forEach: (cb) => docs.forEach(cb)
  };
};

export const Timestamp = {
  fromMillis: (ms: number) => {
    return real.Timestamp.fromMillis(ms);
  },
  now: () => {
    return real.Timestamp.now();
  }
};
