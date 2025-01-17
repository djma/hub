import Server from '~/network/rpc/flatbuffers/server';
import { jestBinaryRocksDB } from '~/storage/db/jestUtils';
import Client from '~/network/rpc/flatbuffers/client';
import MessageModel from '~/storage/flatbuffers/messageModel';
import Factories from '~/test/factories/flatbuffer';
import Engine from '~/storage/engine/flatbuffers';
import { CastAddModel, SignerAddModel } from '~/storage/flatbuffers/types';
import { Wallet, utils } from 'ethers';
import { generateEd25519KeyPair } from '~/utils/crypto';
import IdRegistryEventModel from '~/storage/flatbuffers/idRegistryEventModel';
import { KeyPair } from '~/types';
import { CastId, UserId } from '~/utils/generated/message_generated';
import { HubError } from '~/utils/hubErrors';

const db = jestBinaryRocksDB('flatbuffers.rpc.castService.test');
const engine = new Engine(db);

let server: Server;
let client: Client;

beforeAll(async () => {
  server = new Server(engine);
  const port = await server.start();
  client = new Client(port);
});

afterAll(async () => {
  client.close();
  await server.stop();
});

const fid = Factories.FID.build();
const wallet = Wallet.createRandom();
let custodyEvent: IdRegistryEventModel;
let signer: KeyPair;
let signerAdd: SignerAddModel;
let castAdd: CastAddModel;

beforeAll(async () => {
  custodyEvent = new IdRegistryEventModel(
    await Factories.IdRegistryEvent.create(
      { to: Array.from(utils.arrayify(wallet.address)), fid: Array.from(fid) },
      { transient: { wallet } }
    )
  );

  signer = await generateEd25519KeyPair();
  const signerAddData = await Factories.SignerAddData.create({
    body: Factories.SignerBody.build({ signer: Array.from(signer.publicKey) }),
    fid: Array.from(fid),
  });
  signerAdd = new MessageModel(
    await Factories.Message.create({ data: Array.from(signerAddData.bb?.bytes() ?? []) }, { transient: { wallet } })
  ) as SignerAddModel;

  const castAddData = await Factories.CastAddData.create({
    fid: Array.from(fid),
  });
  castAdd = new MessageModel(
    await Factories.Message.create({ data: Array.from(castAddData.bb?.bytes() ?? []) }, { transient: { signer } })
  ) as CastAddModel;
});

describe('getCast', () => {
  test('succeeds', async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
    await engine.mergeMessage(castAdd);
    const result = await client.getCast(fid, castAdd.tsHash());
    expect(result._unsafeUnwrap()).toEqual(castAdd);
  });

  test('fails if cast is missing', async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
    const result = await client.getCast(fid, castAdd.tsHash());
    expect(result._unsafeUnwrapErr().errCode).toEqual('not_found');
  });

  test('fails without fid or tsHash', async () => {
    const result = await client.getCast(new Uint8Array(), new Uint8Array());
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'fid is missing'));
  });

  test('fails without tsHash', async () => {
    const result = await client.getCast(fid, new Uint8Array());
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'tsHash is missing'));
  });

  test('fails without fid', async () => {
    const result = await client.getCast(new Uint8Array(), castAdd.tsHash());
    expect(result._unsafeUnwrapErr()).toEqual(new HubError('bad_request.validation_failure', 'fid is missing'));
  });
});

describe('getCastsByFid', () => {
  beforeEach(async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
  });

  test('succeeds', async () => {
    await engine.mergeMessage(castAdd);
    const casts = await client.getCastsByFid(fid);
    // The underlying buffers are different, so we can't compare casts to [castAdd] directly
    expect(casts._unsafeUnwrap().map((cast) => cast.hash())).toEqual([castAdd.hash()]);
  });

  test('returns empty array without casts', async () => {
    const casts = await client.getCastsByFid(fid);
    expect(casts._unsafeUnwrap()).toEqual([]);
  });
});

describe('getCastsByParent', () => {
  beforeEach(async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
  });

  test('succeeds', async () => {
    await engine.mergeMessage(castAdd);
    const casts = await client.getCastsByParent(castAdd.body().parent() ?? new CastId());
    // The underlying buffers are different, so we can't compare casts to [castAdd] directly
    expect(casts._unsafeUnwrap().map((cast) => cast.hash())).toEqual([castAdd.hash()]);
  });

  test('returns empty array without casts', async () => {
    const casts = await client.getCastsByParent(castAdd.body().parent() ?? new CastId());
    expect(casts._unsafeUnwrap()).toEqual([]);
  });
});

describe('getCastsByMention', () => {
  beforeEach(async () => {
    await engine.mergeIdRegistryEvent(custodyEvent);
    await engine.mergeMessage(signerAdd);
  });

  test('succeeds', async () => {
    await engine.mergeMessage(castAdd);
    for (let i = 0; i < castAdd.body().mentionsLength(); i++) {
      const casts = await client.getCastsByMention(castAdd.body().mentions(i) ?? new UserId());
      expect(casts._unsafeUnwrap().map((cast) => cast.hash())).toEqual([castAdd.hash()]);
    }
  });

  test('returns empty array without casts', async () => {
    for (let i = 0; i < castAdd.body().mentionsLength(); i++) {
      const casts = await client.getCastsByMention(castAdd.body().mentions(i) ?? new UserId());
      expect(casts._unsafeUnwrap()).toEqual([]);
    }
  });
});
