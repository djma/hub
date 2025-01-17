import grpc from '@grpc/grpc-js';
import Engine from '~/storage/engine/flatbuffers';
import { defaultMethod, toServiceError } from '~/network/rpc/flatbuffers/server';
import { toByteBuffer } from '~/storage/flatbuffers/utils';
import { Message } from '~/utils/generated/message_generated';
import { HubError } from '~/utils/hubErrors';
import MessageModel from '~/storage/flatbuffers/messageModel';
import { NameRegistryEvent } from '~/utils/generated/nameregistry_generated';
import NameRegistryEventModel from '~/storage/flatbuffers/nameRegistryEventModel';
import IdRegistryEventModel from '~/storage/flatbuffers/idRegistryEventModel';
import { IdRegistryEvent } from '~/utils/generated/id_registry_event_generated';

export const submitServiceMethods = () => {
  return {
    submitMessage: {
      ...defaultMethod,
      path: '/submitMessage',
      requestDeserialize: (buffer: Buffer): Message => {
        return Message.getRootAsMessage(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): Message => {
        return Message.getRootAsMessage(toByteBuffer(buffer));
      },
    },

    submitContractEvent: {
      ...defaultMethod,
      path: '/submitContractEvent',
      requestDeserialize: (buffer: Buffer): IdRegistryEvent => {
        return IdRegistryEvent.getRootAsIdRegistryEvent(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): IdRegistryEvent => {
        return IdRegistryEvent.getRootAsIdRegistryEvent(toByteBuffer(buffer));
      },
    },

    submitNameRegistryEvent: {
      ...defaultMethod,
      path: '/submitNameRegistryEvent',
      requestDeserialize: (buffer: Buffer): NameRegistryEvent => {
        return NameRegistryEvent.getRootAsNameRegistryEvent(toByteBuffer(buffer));
      },
      responseDeserialize: (buffer: Buffer): NameRegistryEvent => {
        return NameRegistryEvent.getRootAsNameRegistryEvent(toByteBuffer(buffer));
      },
    },
  };
};

export const submitServiceImpls = (engine: Engine) => {
  return {
    submitMessage: async (call: grpc.ServerUnaryCall<Message, Message>, callback: grpc.sendUnaryData<Message>) => {
      const model = new MessageModel(call.request);
      const result = await engine.mergeMessage(model);
      result.match(
        () => {
          callback(null, model.message);
        },
        (err: HubError) => {
          callback(toServiceError(err));
        }
      );
    },

    submitContractEvent: async (
      call: grpc.ServerUnaryCall<IdRegistryEvent, IdRegistryEvent>,
      callback: grpc.sendUnaryData<IdRegistryEvent>
    ) => {
      const model = new IdRegistryEventModel(call.request);
      const result = await engine.mergeIdRegistryEvent(model);
      result.match(
        () => {
          callback(null, model.event);
        },
        (err: HubError) => {
          callback(toServiceError(err));
        }
      );
    },

    submitNameRegistryEvent: async (
      call: grpc.ServerUnaryCall<NameRegistryEvent, NameRegistryEvent>,
      callback: grpc.sendUnaryData<NameRegistryEvent>
    ) => {
      const model = new NameRegistryEventModel(call.request);
      const result = await engine.mergeNameRegistryEvent(model);
      result.match(
        () => {
          callback(null, model.event);
        },
        (err: HubError) => {
          callback(toServiceError(err));
        }
      );
    },
  };
};
